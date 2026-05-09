import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, ClipboardList, ShoppingCart, Euro, Factory, CalendarHeart, Mail } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardShell, { type ShellNavItem } from "@/components/layout/DashboardShell";
import UserManagement from "@/components/dashboard/UserManagement";
import BackOffice from "@/components/dashboard/BackOffice";
import OrderOverview from "@/components/dashboard/OrderOverview";
import Financials from "@/components/dashboard/Financials";
import Production from "@/components/dashboard/Production";
import PopupEventsTab from "@/components/dashboard/PopupEventsTab";
import SubscribersTab from "@/components/dashboard/SubscribersTab";

type NavItem = ShellNavItem & {
  bakerOnly?: boolean;
  mobileHidden?: boolean;
};

const navigationItems: NavItem[] = [
  { name: "Gebruikersbeheer", icon: Users, bakerOnly: true, mobileHidden: true },
  { name: "Back-office", icon: ClipboardList, mobileHidden: true },
  { name: "Pop-up events", icon: CalendarHeart, bakerOnly: true },
  { name: "Bestellingen", icon: ShoppingCart },
  { name: "Productie", icon: Factory, bakerOnly: true },
  { name: "Subscribers", icon: Mail, bakerOnly: true, mobileHidden: true },
  { name: "Financieel", icon: Euro, bakerOnly: true, mobileHidden: true },
];

const TAB_SLUGS: Record<string, string> = {
  "gebruikersbeheer": "Gebruikersbeheer",
  "back-office": "Back-office",
  "popup-events": "Pop-up events",
  "bestellingen": "Bestellingen",
  "productie": "Productie",
  "subscribers": "Subscribers",
  "financieel": "Financieel",
};
const NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([s, n]) => [n, s])
);

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("Bestellingen");
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut, isBaker } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        if (!error && data) setUserName(data.full_name);
      } catch (err) {
        console.error("Error fetching user name:", err);
      }
    };
    fetchUserName();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleProfileUpdate = (newName: string) => setUserName(newName);

  const visibleNavItems = navigationItems.filter((item) => {
    const roleAllowed = !item.bakerOnly || isBaker;
    const mobileAllowed = !isMobile || !item.mobileHidden;
    return roleAllowed && mobileAllowed;
  });

  const getDefaultTab = () => (isMobile ? "Bestellingen" : "Pop-up events");
  const currentTab = visibleNavItems.find((item) => item.name === activeTab)
    ? activeTab
    : getDefaultTab();

  const renderContent = () => {
    switch (currentTab) {
      case "Gebruikersbeheer":
        return <UserManagement />;
      case "Back-office":
        return <BackOffice />;
      case "Pop-up events":
        return <PopupEventsTab />;
      case "Bestellingen":
        return <OrderOverview />;
      case "Productie":
        return <Production />;
      case "Subscribers":
        return <SubscribersTab />;
      case "Financieel":
        return <Financials />;
      default:
        return <OrderOverview />;
    }
  };

  const displayName = userName || user?.email || "Gebruiker";
  const roleLabel = isBaker ? "Bakker" : "Geen rol";

  return (
    <DashboardShell
      navItems={visibleNavItems.map(({ name, icon }) => ({ name, icon }))}
      currentTab={currentTab}
      onTabChange={setActiveTab}
      userName={displayName}
      roleLabel={roleLabel}
      user={user}
      onProfileUpdate={handleProfileUpdate}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardShell>
  );
};

export default Dashboard;
