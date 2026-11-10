import type { Metadata } from "next";
import "../../marketing.css";
import "../../../styles/agentMarkdown.css";
import "../../jrecommender/jobs.css";
import "../../analyzer/analyzer.css";
import "./history.css";
import { HistoryWorkspace } from "./HistoryWorkspace";

export const metadata: Metadata = {
  title: "Resume History",
  description: "Review resumes you have analyzed with JobGenius.",
};

export default function HistoryPage() {
  return <HistoryWorkspace />;
}
