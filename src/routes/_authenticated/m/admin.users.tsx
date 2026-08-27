import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/admin-workspace";

export const Route = createFileRoute("/_authenticated/m/admin/users")({
  component: () => <AdminPage section="users" />,
});
