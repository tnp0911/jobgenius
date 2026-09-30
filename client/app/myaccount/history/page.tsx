import type { Metadata } from "next";
import "./history.css";
import { HistoryWorkspace } from "./HistoryWorkspace";

export const metadata: Metadata = {
  title: "Resume History",
  description: "Review resumes you have analyzed with JobGenius.",
};

export default function HistoryPage() {
  return <HistoryWorkspace />;
}
