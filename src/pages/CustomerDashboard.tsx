import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ShoppingBag, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import ProfileDialog from "@/components/ProfileDialog";
import CustomerOrdersTab from "@/components/customer/CustomerOrdersTab";
import CustomerPlaceOrderTab from "@/components/customer/CustomerPlaceOrderTab";

const navigationItems = [
  { name: "Mijn bestellingen", icon: ShoppingCart, href: "/customer/orders" },
  { name: "Bestelling plaatsen", icon: ShoppingBag, href: "/customer/place-order" },
];

const CustomerDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Mijn bestellingen");
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut, role } = useAuth();
  const isMobile = useIsMobile();

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

  const renderContent = () => {
    switch (activeTab) {
      case "Mijn bestellingen":
        return <CustomerOrdersTab />;
      case "Bestelling plaatsen":
        return <CustomerPlaceOrderTab />;
      default:
        return <CustomerOrdersTab />;
    }
  };

  // Display name: prefer full_name, fallback to email
  const displayName = userName || user?.email || "Klant";
  const firstName = displayName.split(" ")[0];

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
          {navigationItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium
                transition-colors duration-150
                ${activeTab === item.name 
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
                {role === "customer" ? "Klant" : role || "Geen rol"}
              </p>
            </div>
            <ProfileDialog user={user} onProfileUpdate={handleProfileUpdate} />
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
              Beste {firstName}, welkom bij Bosgoedt Bakery
            </h2>
          </div>
          <div className="text-sm text-muted-foreground hidden sm:block">
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

export default CustomerDashboard;
