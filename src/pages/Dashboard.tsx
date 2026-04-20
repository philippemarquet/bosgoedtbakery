import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ClipboardList, ShoppingCart, Euro, Factory } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardShell, { type ShellNavItem } from "@/components/layout/DashboardShell";
import UserManagement from "@/components/dashboard/UserManagement";
import BackOffice from "@/components/dashboard/BackOffice";
import OrderOverview from "@/components/dashboard/OrderOverview";
import Financials from "@/components/dashboard/Financials";
import Production from "@/components/dashboard/Production";

type NavItem = ShellNavItem & {
  bakerOnly?: boolean;
  mobileHidden?: boolean;
};

const navigationItems: NavItem[] = [
  { name: "Gebruikersbeheer", icon: Users, bakerOnly: true, mobileHidden: true },
  { name: "Back-office", icon: ClipboardList, mobileHidden: true },
  { name: "Bestellingen", icon: ShoppingCart },
  { name: "Productie", icon: Factory, bakerOnly: true },
  { name: "Financieel", icon: Euro, bakerOnly: true, mobileHidden: true },
];

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("Gebruikersbeheer");
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut, isBaker, role } = useAuth();
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

        if (!error && data) {
          setUserName(data.full_name);
        }
      } catch (err) {
        console.error("Error fetching user name:", err);
      }
    };

    fetchUserName();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleProfileUpdate = (newName: string) => {
    setUserName(newName);
  };

  // Filter: rol + viewport
  const visibleNavItems = navigationItems.filter((item) => {
    const roleAllowed = !item.bakerOnly || isBaker;
    const mobileAllowed = !isMobile || !item.mobileHidden;
    return roleAllowed && mobileAllowed;
  });

  // Default tab afhankelijk van rol/viewport
  const getDefaultTab = () => {
    if (isMobile) return "Bestellingen";
    if (isBaker) return "Gebruikersbeheer";
    return "Back-office";
  };

  const currentTab = visibleNavItems.find((item) => item.name === activeTab)
    ? activeTab
    : getDefaultTab();

  const renderContent = () => {
    switch (currentTab) {
      case "Gebruikersbeheer":
        return <UserManagement />;
      case "Back-office":
        return <BackOffice />;
      case "Bestellingen":
        return <OrderOverview />;
      case "Productie":
        return <Production />;
      case "Financieel":
        return <Financials />;
      default:
        return <BackOffice />;
    }
  };

  const displayName = userName || user?.email || "Gebruiker";
  const roleLabel = role === "baker" ? "Bakker" : role === "customer" ? "Klant" : "Geen rol";

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
