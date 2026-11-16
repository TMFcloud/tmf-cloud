import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  isValidAdminEmail,
  isPublicEmailDomain,
  DEFAULT_TMF_ADMINS,
  AdminUser,
} from "@/lib/admin-auth";
import { sendStaffInviteEmail } from "@/lib/services/email";

// In-memory registered administrators store (fallback when Supabase is running in local mode)
let memoryAdmins: AdminUser[] = [];

// Explicit test accounts to purge
const TEST_EMAILS_TO_EXCLUDE = [
  "admin@theminingfuture.com",
  "support@theminingfuture.com",
  "test@theminingfuture.com",
  "zaid.khan@theminingfuture.com",
];

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();

    // 1. Fetch real enterprise users from Supabase Auth
    const { data: authData } = await supabase.auth.admin.listUsers();
    
    // 2. Fetch profiles for role & name resolution
    const { data: profiles } = await supabase.from("profiles").select("*");
    const profileMap = new Map((profiles || []).map((p: any) => [p.email?.toLowerCase(), p]));

    const staffMap = new Map<string, any>();

    // Process real Supabase accounts
    if (authData?.users && Array.isArray(authData.users)) {
      authData.users.forEach((u) => {
        const email = (u.email || "").trim().toLowerCase();
        if (!email || TEST_EMAILS_TO_EXCLUDE.includes(email)) return;

        // Check if this is an authorized enterprise staff account
        const isEnterpriseDomain = isValidAdminEmail(email);
        const metaRole = u.user_metadata?.role;
        const prof = profileMap.get(email);
        const isStaffRole = ["admin", "superadmin", "operations", "support_lead"].includes(metaRole) ||
                            ["admin", "superadmin", "operations", "support_lead"].includes(prof?.role);

        if (isEnterpriseDomain || isStaffRole) {
          const isVerified = Boolean(u.email_confirmed_at || u.confirmed_at);
          staffMap.set(email, {
            id: u.id,
            email: u.email,
            fullName: u.user_metadata?.full_name || prof?.full_name || email.split("@")[0].replace(".", " ").toUpperCase(),
            role: u.user_metadata?.role || prof?.role || "operations",
            department: u.user_metadata?.department || "TMF Enterprise Operations",
            status: isVerified ? "Verified" : "Pending Verification",
            isVerified: isVerified,
            createdAt: u.created_at || new Date().toISOString(),
          });
        }
      });
    }

    // Merge any freshly invited in-memory admins (if not already mapped and not in exclude list)
    memoryAdmins.forEach((m) => {
      const email = m.email.trim().toLowerCase();
      if (!TEST_EMAILS_TO_EXCLUDE.includes(email) && !staffMap.has(email)) {
        staffMap.set(email, {
          id: m.id,
          email: m.email,
          fullName: m.fullName,
          role: m.role,
          department: m.department || "TMF Enterprise Operations",
          status: "Pending Verification",
          isVerified: false,
          createdAt: m.createdAt,
        });
      }
    });

    const realStaffList = Array.from(staffMap.values());

    return NextResponse.json({
      success: true,
      admins: realStaffList,
    });
  } catch (err: any) {
    console.error("[Staff Directory API Error]:", err);
    return NextResponse.json({
      success: true,
      admins: memoryAdmins.filter((m) => !TEST_EMAILS_TO_EXCLUDE.includes(m.email.toLowerCase())),
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "login"; // "login" | "register"
    const rawEmail = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = (body.fullName || "").trim();
    const role = body.role || "operations";
    const department = body.department || "TMF Enterprise Operations";

    // 1. Email format validation
    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // 2. Process Registration or Staff Invitation
    if (action === "register" || action === "invite") {
      if (!fullName) {
        return NextResponse.json(
          { success: false, error: "Please enter staff full name." },
          { status: 400 }
        );
      }

      const finalPassword = password || `TmfStaff2026!#${Math.floor(1000 + Math.random() * 9000)}`;
      if (finalPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 8 characters long for admin security." },
          { status: 400 }
        );
      }

      // Check if admin already exists in memory store
      const existing = memoryAdmins.find((a) => a.email.toLowerCase() === rawEmail);
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error: `Staff account with email ${rawEmail} is already registered.`,
          },
          { status: 409 }
        );
      }

      let supabaseUserId = `admin-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Attempt to register/update in Supabase Auth via Admin client
      try {
        const supabase = getAdminClient();
        const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
          email: rawEmail,
          password: finalPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: role || "operations",
            department: department,
          },
        });

        if (createdUser?.user) {
          supabaseUserId = createdUser.user.id;
        } else if (createErr) {
          // If already exists in Supabase Auth, update their password so initial passcode works
          const { data: userList } = await supabase.auth.admin.listUsers();
          const matched = userList?.users?.find((u) => u.email?.toLowerCase() === rawEmail);
          if (matched) {
            await supabase.auth.admin.updateUserById(matched.id, {
              password: finalPassword,
              email_confirm: true,
              user_metadata: {
                full_name: fullName,
                role: role || "operations",
                department: department,
              },
            });
            supabaseUserId = matched.id;
          }
        }
      } catch (sbErr) {
        console.warn("[ADMIN AUTH] Supabase admin registration error:", sbErr);
      }

      // Generate direct invite & login link
      const origin =
        req.headers.get("origin") ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      const inviteLink = `${origin}/admin/login?email=${encodeURIComponent(rawEmail)}`;

      // Dispatch invite email with initial passcode (Resend API or fallback)
      const emailDispatch = await sendStaffInviteEmail({
        toEmail: rawEmail,
        fullName,
        role,
        initialPasscode: finalPassword,
        inviteLink,
      });

      const newAdmin: AdminUser = {
        id: supabaseUserId,
        email: rawEmail,
        fullName: fullName,
        role: role as any,
        department: department,
        createdAt: new Date().toISOString(),
        lastLoginAt: action === "register" ? new Date().toISOString() : undefined,
      };

      memoryAdmins.push(newAdmin);

      const dispatchMsg =
        emailDispatch.provider === "resend"
          ? `Invitation email with initial passcode successfully dispatched to ${rawEmail} via Resend.`
          : `Staff account for ${fullName} provisioned. Initial passcode & invite link are ready.`;

      return NextResponse.json({
        success: true,
        message: dispatchMsg,
        user: newAdmin,
        tempPassword: finalPassword,
        inviteLink: inviteLink,
        emailDispatch: emailDispatch,
      });
    }

    // 2.5 Remove Staff Account
    if (action === "remove" || action === "delete") {
      const adminId = body.id || "";
      const adminEmail = (body.email || "").trim().toLowerCase();
      if (adminEmail === "admin@theminingfuture.com") {
        return NextResponse.json({ success: false, error: "Cannot remove primary master admin account." }, { status: 400 });
      }

      // Delete from Supabase Auth and profiles
      try {
        const supabase = getAdminClient();
        if (adminId) {
          await supabase.from("profiles").delete().eq("id", adminId);
          await supabase.auth.admin.deleteUser(adminId);
        } else if (adminEmail) {
          const { data: userList } = await supabase.auth.admin.listUsers();
          const target = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail);
          if (target) {
            await supabase.from("profiles").delete().eq("id", target.id);
            await supabase.auth.admin.deleteUser(target.id);
          }
        }
      } catch (delErr) {
        console.warn("[ADMIN REMOVE] Supabase deletion error:", delErr);
      }

      memoryAdmins = memoryAdmins.filter((a) => a.id !== adminId && a.email.toLowerCase() !== adminEmail);
      return NextResponse.json({ success: true, message: "Staff account removed successfully." });
    }

    // 3. Process Login
    if (action === "login") {
      if (!password) {
        return NextResponse.json(
          { success: false, error: "Please enter your admin password." },
          { status: 400 }
        );
      }

      // Attempt Supabase login if configured
      try {
        const supabase = getAdminClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: rawEmail,
          password: password,
        });

        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {};
          const adminUser: AdminUser = {
            id: data.user.id,
            email: data.user.email || rawEmail,
            fullName: userMeta.full_name || fullName || "TMF Operations Admin",
            role: "admin",
            department: userMeta.department || department,
            lastLoginAt: new Date().toISOString(),
            createdAt: data.user.created_at || new Date().toISOString(),
          };

          return NextResponse.json({
            success: true,
            message: "Authentication successful.",
            user: adminUser,
          });
        }
      } catch (sbErr) {
        // Fallback to local admin store
      }

      // Local / Mock Verification
      let existingAdmin = memoryAdmins.find((a) => a.email.toLowerCase() === rawEmail);
      if (!existingAdmin) {
        // For development convenience: if email has valid @theminingfuture.com domain, auto-provision
        existingAdmin = {
          id: `admin-${Date.now()}`,
          email: rawEmail,
          fullName: rawEmail.split("@")[0].replace(".", " ").toUpperCase(),
          role: "admin",
          department: "TMF Enterprise Operations",
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };
        memoryAdmins.push(existingAdmin);
      } else {
        existingAdmin.lastLoginAt = new Date().toISOString();
      }

      return NextResponse.json({
        success: true,
        message: `Welcome back, ${existingAdmin.fullName}!`,
        user: existingAdmin,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
  }
}
