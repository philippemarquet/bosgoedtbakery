import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Home, 
  ShoppingCart, 
  Users, 
  Package, 
  Calculator, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChefHat
} from "lucide-react";

// Placeholder for the current user - will be replaced with actual auth
const mockUser = {
  name: "Baker Admin",
  role: "admin" as const,
};

const navigationItems = [
  { name: "Dashboard", icon: Home, href: "/dashboard" },
  { name: "Bestellingen", icon: ShoppingCart, href: "/dashboard/orders" },
  { name: "Klanten", icon: Users, href: "/dashboard/customers" },
  { name: "Producten", icon: Package, href: "/dashboard/products" },
  { name: "Recepten", icon: ChefHat, href: "/dashboard/recipes" },
  { name: "Calculaties", icon: Calculator, href: "/dashboard/calculations" },
  { name: "Facturen", icon: FileText, href: "/dashboard/invoices" },
  { name: "Instellingen", icon: Settings, href: "/dashboard/settings" },
];

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Implement actual logout
    navigate("/");
  };

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
              onClick={() => setActiveTab(item.name)}
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
                {mockUser.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {mockUser.name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {mockUser.role}
              </p>
            </div>
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
              {activeTab}
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
          {activeTab === "Dashboard" && <DashboardContent />}
          {activeTab !== "Dashboard" && (
            <div className="bakery-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                {activeTab}
              </h3>
              <p className="text-muted-foreground">
                Deze pagina wordt binnenkort toegevoegd.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const DashboardContent = () => {
  const stats = [
    { label: "Openstaande bestellingen", value: "12", change: "+3 vandaag" },
    { label: "Te bakken vandaag", value: "48", change: "broden" },
    { label: "Klanten", value: "24", change: "actieve klanten" },
    { label: "Omzet deze week", value: "€ 1.240", change: "+15% vs vorige week" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={stat.label}
            className="bakery-card p-6 animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-3xl font-serif font-semibold text-foreground mb-1">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bakery-card p-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <h3 className="text-lg font-serif font-semibold text-foreground mb-4">
            Vandaag te bakken
          </h3>
          <div className="space-y-3">
            {[
              { name: "Zuurdesembrood", quantity: 12 },
              { name: "Volkoren", quantity: 8 },
              { name: "Roggebrood", quantity: 6 },
              { name: "Ciabatta", quantity: 10 },
              { name: "Focaccia", quantity: 12 },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-foreground">{item.name}</span>
                <span className="text-sm font-medium text-primary bg-secondary px-3 py-1 rounded-full">
                  {item.quantity}×
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bakery-card p-6 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <h3 className="text-lg font-serif font-semibold text-foreground mb-4">
            Recente bestellingen
          </h3>
          <div className="space-y-3">
            {[
              { customer: "Jan de Vries", items: 3, status: "In behandeling" },
              { customer: "Marie Bakker", items: 2, status: "Gereed" },
              { customer: "Pieter Jansen", items: 5, status: "In behandeling" },
              { customer: "Lisa van Dam", items: 1, status: "Afgehaald" },
            ].map((order, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-foreground font-medium">{order.customer}</p>
                  <p className="text-sm text-muted-foreground">{order.items} items</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                  order.status === "Gereed" 
                    ? "bg-accent/20 text-accent-foreground" 
                    : order.status === "Afgehaald"
                    ? "bg-muted text-muted-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
