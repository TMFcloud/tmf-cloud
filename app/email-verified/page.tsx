"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const orderIdParam = searchParams.get("orderId");
  const errorParam = searchParams.get("error");

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seconds, setSeconds] = useState(4);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isError, setIsError] = useState(errorParam === "invalid_token");

  // 1. Fetch Restored Order Data
  useEffect(() => {
    async function loadOrder() {
      if (errorParam === "invalid_token") {
        setIsError(true);
        setLoading(false);
        return;
      }

      // Check current session
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      let targetOrderId = orderIdParam;

      // If orderId not in URL, check localStorage or cookies
      if (!targetOrderId && typeof window !== "undefined") {
        targetOrderId = localStorage.getItem("tmf_active_order_id");
      }

      // If still no orderId, query Supabase for latest pending order
      if (!targetOrderId && currentUser) {
        const { data: latestPending } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", currentUser.id)
          .eq("status", "PENDING")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestPending?.id) {
          targetOrderId = latestPending.id;
        }
      }

      if (targetOrderId) {
        try {
          const { data: orderData, error: dbErr } = await supabase
            .from("orders")
            .select("*, pool_destinations(*)")
            .eq("id", targetOrderId)
            .maybeSingle();

          if (!dbErr && orderData) {
            setOrder(orderData);
          }
        } catch (e) {
          console.warn("[EMAIL VERIFIED] Error fetching order:", e);
        }
      }

      setLoading(false);
    }

    loadOrder();
  }, [orderIdParam, errorParam, supabase]);

  // 2. Action to continue to NOWPayments checkout
  const handleContinuePayment = async () => {
    if (isContinuing) return;
    setIsContinuing(true);

    if (order?.id) {
      // Call NOWPayments checkout endpoint
      try {
        const res = await fetch("/api/payments/nowpayments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
        const data = await res.json();
        if (data && data.invoiceUrl) {
          window.location.href = data.invoiceUrl;
          return;
        }
        if (data && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
      } catch (err) {
        console.warn("[CHECKOUT REDIRECT] API fallback:", err);
      }
      // Direct payment page fallback
      window.location.href = `/payment?orderId=${order.id}`;
    } else {
      // If no pending order, direct customer to package selection
      router.push("/buy");
    }
  };

  // 3. 4-Second Countdown Timer (Only enabled when order is confirmed restored)
  useEffect(() => {
    if (loading || isError || !order) return;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleContinuePayment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isError, order]);

  return (
    <div className="email-verified-wrapper">
      {/* HEADER */}
      <header className="verified-header">
        <div className="brand">
          <div className="logo">⌘</div>
          <div>
            THE MINING FUTURE
            <small>CUSTOMER PORTAL</small>
          </div>
        </div>
        <Link className="portal" href="/login">
          Customer Login ↗
        </Link>
      </header>

      {/* MAIN CONTAINER */}
      <main className="verified-main">
        {/* CSS CELEBRATION CONFETTI */}
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />
        <div className="confetti" />

        <section className="success-card">
          {/* SUCCESS ANIMATED ICON */}
          <div className="success-icon">
            <svg viewBox="0 0 52 52">
              <path d="M13 27 L22 36 L40 16" />
            </svg>
          </div>

          <div className="tag">✓ EMAIL VERIFICATION COMPLETE</div>

          <h1>Email Verified!</h1>

          <div className="subtitle">
            Your account is verified. Your mining purchase is ready.
          </div>

          <p className="description">
            Your email address has been successfully verified. Your TMF customer
            account is ready for the next step.
          </p>

          {/* VERIFIED DETAILS CHECKLIST */}
          <div className="details">
            <div className="detail-row">
              <span className="check">✓</span>
              <span>Email verification completed</span>
            </div>
            <div className="detail-row">
              <span className="check">✓</span>
              <span>Customer account confirmed</span>
            </div>
            <div className="detail-row">
              <span className="check">✓</span>
              <span>
                {order
                  ? "Original hashrate order restored"
                  : "Account security active"}
              </span>
            </div>
            <div className="detail-row">
              <span className="check">✓</span>
              <span>Ready for secure payment</span>
            </div>
          </div>

          {/* RESTORED ORDER SUMMARY CARD */}
          {order && (
            <div className="order-summary-box">
              <div className="order-summary-header">
                <span className="order-summary-title">Restored Hashrate Order</span>
                <span className="order-summary-badge">
                  #{order.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="order-summary-grid">
                <div className="summary-col">
                  <span className="summary-label">Purchased Hashrate</span>
                  <span className="summary-val text-green font-mono">
                    {order.hashrate_th.toLocaleString()} TH/s
                  </span>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Duration</span>
                  <span className="summary-val">
                    {order.duration_days} Days
                  </span>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Payable Amount</span>
                  <span className="summary-val text-green font-bold">
                    ${Number(order.total_usd).toFixed(2)} USD
                  </span>
                </div>
                <div className="summary-col">
                  <span className="summary-label">Payment Method</span>
                  <span className="summary-val">
                    NOWPayments ({order.payment_currency || "Crypto"})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PRIMARY CALL TO ACTION BUTTON */}
          {order ? (
            <button
              onClick={handleContinuePayment}
              disabled={isContinuing}
              className="button"
            >
              {isContinuing ? "CONNECTING TO NOWPAYMENTS..." : "CONTINUE TO SECURE PAYMENT →"}
            </button>
          ) : (
            <Link href="/buy" className="button">
              SELECT HASHRATE PACKAGE →
            </Link>
          )}

          {/* REDIRECT COUNTDOWN */}
          {order && !isContinuing && (
            <p className="redirect">
              Redirecting to secure payment in{" "}
              <span id="countdown">{seconds}</span> seconds...
            </p>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="verified-footer">
        THE MINING FUTURE · POWERING YOUR MINING JOURNEY
      </footer>

      {/* EMBEDDED SCOPED STYLES (MATCHING USER SPECIFICATION EXACTLY) */}
      <style jsx>{`
        .email-verified-wrapper {
          --bg: #080b10;
          --card: #111823;
          --green: #a3ff00;
          --white: #f5f7fa;
          --muted: #929baa;
          --border: #273244;
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 50% 35%, #17250d 0%, transparent 45%),
            var(--bg);
          color: var(--white);
          font-family: Inter, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .verified-header {
          height: 68px;
          padding: 0 6%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          background: #0a0e15;
          z-index: 2;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }

        .logo {
          width: 38px;
          height: 38px;
          border: 1px solid var(--green);
          color: var(--green);
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-size: 21px;
          box-shadow: 0 0 18px #a3ff0033;
        }

        .brand small {
          display: block;
          font-size: 9px;
          color: var(--muted);
          margin-top: 3px;
        }

        .portal {
          color: var(--green);
          font-size: 12px;
          text-decoration: none;
          font-weight: 600;
        }

        .verified-main {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 55px 20px;
          position: relative;
        }

        .success-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 42px 35px;
          text-align: center;
          box-shadow: 0 25px 80px #0008;
          animation: appear 0.7s ease-out;
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .success-icon {
          width: 90px;
          height: 90px;
          margin: 0 auto 22px;
          background: #17290b;
          border: 2px solid var(--green);
          border-radius: 50%;
          display: grid;
          place-items: center;
          box-shadow: 0 0 35px #a3ff0040;
          animation: pulse 2s infinite;
        }

        .success-icon svg {
          width: 48px;
          height: 48px;
          stroke: var(--green);
          stroke-width: 2.8;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 100;
          animation: draw 1s ease forwards;
        }

        @keyframes draw {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes pulse {
          50% {
            box-shadow: 0 0 45px #a3ff0066;
          }
        }

        .tag {
          display: inline-block;
          background: #1b2b0e;
          color: var(--green);
          border: 1px solid #456a16;
          border-radius: 30px;
          padding: 7px 14px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 18px;
        }

        h1 {
          font-size: 32px;
          color: var(--green);
          margin-bottom: 10px;
          font-weight: 800;
        }

        .subtitle {
          font-size: 17px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #f5f7fa;
        }

        .description {
          font-size: 13px;
          line-height: 1.7;
          color: var(--muted);
          margin-bottom: 24px;
        }

        .details {
          background: #0c121c;
          border: 1px solid var(--border);
          border-radius: 13px;
          padding: 16px;
          text-align: left;
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 11px;
          margin: 10px 0;
          font-size: 12px;
        }

        .check {
          color: #35e878;
          font-size: 16px;
          font-weight: bold;
        }

        .detail-row span:last-child {
          color: #dce4ee;
        }

        .order-summary-box {
          background: #0c121c;
          border: 1px solid #33445a;
          border-radius: 13px;
          padding: 16px;
          text-align: left;
          margin-bottom: 22px;
        }

        .order-summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid #1c2635;
          padding-bottom: 8px;
        }

        .order-summary-title {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 800;
          color: var(--muted);
          letter-spacing: 0.8px;
        }

        .order-summary-badge {
          background: #192636;
          color: var(--green);
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 6px;
          font-family: monospace;
          font-weight: 700;
        }

        .order-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .summary-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .summary-label {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
        }

        .summary-val {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
        }

        .text-green {
          color: var(--green) !important;
        }

        .button {
          width: 100%;
          display: block;
          background: var(--green);
          color: #101600;
          border: none;
          border-radius: 10px;
          padding: 16px;
          font-weight: 800;
          font-size: 13px;
          text-decoration: none;
          transition: 0.25s;
          cursor: pointer;
          letter-spacing: 0.5px;
        }

        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px #a3ff0044;
        }

        .redirect {
          color: var(--muted);
          font-size: 11px;
          margin-top: 18px;
        }

        /* CONFETTI ANIMATION */
        .confetti {
          position: absolute;
          top: -20px;
          width: 9px;
          height: 15px;
          opacity: 0;
          animation: fall 4s ease-in infinite;
          pointer-events: none;
        }

        .confetti:nth-child(1) { left: 8%; background: #a3ff00; animation-delay: 0s; }
        .confetti:nth-child(2) { left: 17%; background: #35e878; animation-delay: 0.5s; }
        .confetti:nth-child(3) { left: 27%; background: #ffc928; animation-delay: 1s; }
        .confetti:nth-child(4) { left: 38%; background: #a3ff00; animation-delay: 0.3s; }
        .confetti:nth-child(5) { left: 50%; background: #35e878; animation-delay: 1.2s; }
        .confetti:nth-child(6) { left: 62%; background: #ffc928; animation-delay: 0.7s; }
        .confetti:nth-child(7) { left: 74%; background: #a3ff00; animation-delay: 1.5s; }
        .confetti:nth-child(8) { left: 85%; background: #35e878; animation-delay: 0.2s; }
        .confetti:nth-child(9) { left: 94%; background: #ffc928; animation-delay: 1.8s; }

        @keyframes fall {
          0% {
            transform: translateY(-30px) rotate(0deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .verified-footer {
          border-top: 1px solid var(--border);
          padding: 19px;
          text-align: center;
          color: var(--muted);
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 520px) {
          .verified-header {
            padding: 0 18px;
          }
          .success-card {
            padding: 32px 22px;
          }
          h1 {
            font-size: 27px;
          }
          .subtitle {
            font-size: 16px;
          }
          .order-summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default function EmailVerifiedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080B10] flex items-center justify-center text-xs text-[#8CFF00] font-mono">
          Verifying security state...
        </div>
      }
    >
      <EmailVerifiedContent />
    </Suspense>
  );
}
