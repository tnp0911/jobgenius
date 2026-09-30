import type { Metadata } from "next";
import { MyAccountWorkspace } from "./MyAccountWorkspace";

export const metadata: Metadata = {
  title: "My Account",
  description:
    "View the name, email, and plan on your JobGenius account.",
};

export default function MyAccountPage() {
  return <MyAccountWorkspace />;
}
