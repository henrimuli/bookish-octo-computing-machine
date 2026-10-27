import { redirect } from "next/navigation";

/** The admin area starts at the dashboard; the review queue moved to /admin/review. */
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
