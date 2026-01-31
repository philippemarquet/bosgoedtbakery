import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  ClipboardList, 
  ShoppingCart, 
  Euro,
  LogOut,
  Menu,
  X,
  Factory
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileDialog from "@/components/ProfileDialog";
import UserManagement from "@/components/dashboard/UserManagement";
import BackOffice from "@/components/dashboard/BackOffice";
import OrderOverview from "@/components/dashboard/OrderOverview";
import Financials from "@/components/dashboard/Financials";
import Production from "@/components/dashboard/Production";

const navigationItems = [
  { name: "Gebruikersbeheer", icon: Users, href: "/dashboard/users", bakerOnly: true },
  { name: "Back-office", icon: ClipboardList, href: "/dashboard/backoffice" },
  { name: "Bestellingen", icon: ShoppingCart, href: "/dashboard/orders" },
  { name: "Productie", icon: Factory, href: "/dashboard/production", bakerOnly: true },
  { name: "Financieel", icon: Euro, href: "/dashboard/financials", bakerOnly: true },
];

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Gebruikersbeheer");
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut, isBaker, role } = useAuth();

  // Fetch user's name from profile
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

  // Filter navigation items based on role
  const visibleNavItems = navigationItems.filter(
    item => !item.bakerOnly || isBaker
  );

  // Set default tab based on role
  const getDefaultTab = () => {
    if (isBaker) return "Gebruikersbeheer";
    return "Back-office";
  };

  // Ensure activeTab is valid for current role
  const currentTab = visibleNavItems.find(item => item.name === activeTab) 
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

  // Display name: prefer full_name, fallback to email
  const displayName = userName || user?.email || "Gebruiker";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-sidebar-border">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-sidebar-foreground">Bosgoedt</h1>
            <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Bakery</p>
          </div>
          <button 
            className="lg:hidden p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium
                transition-colors duration-150
                ${currentTab === item.name 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </button>
          ))}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-sidebar-accent">
            <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center">
              <span className="text-sm font-semibold text-sidebar-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {role === "baker" ? "Bakker" : role === "customer" ? "Klant" : "Geen rol"}
              </p>
            </div>
            <ProfileDialog onProfileUpdate={handleProfileUpdate} />
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              title="Uitloggen"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="h-20 flex items-center justify-between px-6 border-b border-border bg-card">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-foreground hover:bg-muted rounded-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-serif font-semibold text-foreground">
              {currentTab}
            </h2>
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("nl-NL", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
