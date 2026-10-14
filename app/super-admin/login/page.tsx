import { notFound } from "next/navigation";

// Super Admin login is permanently disabled from this legacy path.
// Access is strictly restricted to the dedicated secret gateway.
export default function SuperAdminLoginHidden() {
  notFound();
}
