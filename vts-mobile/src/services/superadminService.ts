import { api } from "./api";
import { ENDPOINTS } from "../config/apiConfig";
import { SystemOverviewSummary, OrganizationOverview } from "../types/SystemOverview";

export const fetchSystemOverviewSummary = async () => {
  const res = await api.get<SystemOverviewSummary>(ENDPOINTS.SYSTEM_OVERVIEW_SUMMARY);
  return res.data;
};

export const fetchSystemOverviewOrganizations = async () => {
  const res = await api.get<OrganizationOverview[]>(ENDPOINTS.SYSTEM_OVERVIEW_ORGANIZATIONS);
  return res.data;
};

export const fetchSystemOverviewOrganization = async (orgId: number) => {
  const res = await api.get<OrganizationOverview>(`${ENDPOINTS.SYSTEM_OVERVIEW_ORGANIZATIONS}/${orgId}`);
  return res.data;
};
