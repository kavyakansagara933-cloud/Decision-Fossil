import React from "react";
import { Badge } from "./badge";
import { DecisionStatus } from "@/types/decision";

interface DecisionStatusBadgeProps {
  status: DecisionStatus | string;
  size?: "sm" | "md";
}

export const DecisionStatusBadge: React.FC<DecisionStatusBadgeProps> = ({ status, size = "md" }) => {
  switch (status) {
    case "DRAFT":
      return <Badge variant="neutral" size={size}>Draft</Badge>;
    case "PROPOSED":
      return <Badge variant="warning" size={size}>Proposed</Badge>;
    case "DECIDED":
      return <Badge variant="success" size={size}>Decided</Badge>;
    case "MONITORING":
      return <Badge variant="default" size={size}>Monitoring</Badge>;
    case "REASSESSING":
      return <Badge variant="warning" size={size}>Reassessing</Badge>;
    case "VALIDATED":
      return <Badge variant="success" size={size}>Validated</Badge>;
    case "REJECTED":
      return <Badge variant="destructive" size={size}>Rejected</Badge>;
    case "SUPERSEDED":
      return <Badge variant="neutral" size={size}>Superseded</Badge>;
    default:
      return <Badge variant="default" size={size}>{status}</Badge>;
  }
};
