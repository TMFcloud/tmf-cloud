import { redirect } from "next/navigation";

export default function DashboardBuyPage() {
  redirect("/dashboard?action=buy");
}
