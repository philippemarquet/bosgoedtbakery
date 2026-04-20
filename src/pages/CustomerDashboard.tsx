import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ShoppingBag } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardShell, { type ShellNavItem } from "@/components/layout/DashboardShell";
import CustomerOrdersTab from "@/components/customer/CustomerOrdersTab";
import CustomerPlaceOrderTab from "@/components/customer/CustomerPlaceOrderTab";

const navigationItems: ShellNavItem[] = [
  { name: "Mijn bestellingen", icon: ShoppingCart },
  { name: "Bestelling plaatsen", icon: ShoppingBag },
];

const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState("Mijn bestellingen");
  const [userName, setUserName] = useState<string | null>(null);

  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();

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
    navigate("/");
  };

  const handleProfileUpdate = (newName: string) => setUserName(newName);

  const renderContent = () => {
    switch (activeTab) {
      case "Mijn bestellingen":
        return <CustomerOrdersTab />;
      case "Bestelling plaatsen":
        return (
          <CustomerPlaceOrderTab
            onOrderCreated={() => setActiveTab("Mijn bestellingen")}
          />
        );
      default:
        return <CustomerOrdersTab />;
    }
  };

  const displayName = userName || user?.email || "Klant";
  const firstName = displayName.split(" ")[0];
  const roleLabel = role === "customer" ? "Klant" : role ? role : "Geen rol";

  return (
    <DashboardShell
      navItems={navigationItems}
      currentTab={activeTab}
      onTabChange={setActiveTab}
      pageTitle={`Welkom, ${firstName}`}
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

export default CustomerDashboard;
