import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bike,
  ClipboardList,
  Package,
  BarChart3,
  Wrench,
  Users,
  Clock,
  Shield,
  ArrowRight,
  CheckCircle2,
  User,
  LogOut,
} from "lucide-react";
import { PublicFooter, PUBLIC_NAV } from "@/components/public/PublicLayout";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const homePath = profile?.role === "investor" ? "/investor" : "/dashboard";

  const features = [
    {
      icon: ClipboardList,
      title: "Streamlined Intake",
      description: "Quick bike intake with photo documentation and condition tracking",
    },
    {
      icon: Wrench,
      title: "Service Management",
      description: "Track cleaning, repairs, and maintenance with detailed job cards",
    },
    {
      icon: Package,
      title: "Parts Inventory",
      description: "Manage parts stock, suppliers, and reordering with ease",
    },
    {
      icon: Users,
      title: "Owner Portal",
      description: "Keep owners informed with real-time status updates and notifications",
    },
    {
      icon: BarChart3,
      title: "Business Analytics",
      description: "Make data-driven decisions with comprehensive reporting tools",
    },
    {
      icon: Clock,
      title: "Workflow Automation",
      description: "Automate repetitive tasks and reduce manual data entry",
    },
  ];

  const benefits = [
    "Reduce processing time by 60%",
    "Eliminate paperwork and manual tracking",
    "Improve customer satisfaction scores",
    "Increase workshop efficiency",
    "Real-time inventory visibility",
    "Integrated delivery management",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Bike className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">VeloDealer</span>
            </div>
            <nav className="order-last w-full overflow-x-auto md:order-none md:w-auto">
              <ul className="flex items-center gap-4 text-sm whitespace-nowrap">
                {PUBLIC_NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Button onClick={() => navigate(homePath)}>
                    Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Avatar>
                          <AvatarFallback>
                            {profile?.name?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{profile?.name}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(homePath)}>
                        <User className="mr-2 h-4 w-4" />
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                  <Button onClick={() => navigate("/auth")}>
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            <Shield className="h-4 w-4 mr-2 inline" />
            Trusted by Bike Dealers Worldwide
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            The Complete Platform for
            <span className="text-primary"> Bicycle Dealer Management</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your bike shop operations from intake to delivery. Manage inventory, 
            track repairs, and delight customers with VeloDealer's all-in-one solution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link to="/features">See all features</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Run Your Bike Shop
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed specifically for bicycle dealers and service centers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="mb-4 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Transform Your Bike Shop Operations
              </h2>
              <p className="text-lg text-muted-foreground">
                Join hundreds of dealers who have already modernized their workflow
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start space-x-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-lg text-foreground">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
                Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Streamline Your Bike Shop?
            </h2>
            <p className="text-xl opacity-90">
              Start your free trial today and see why VeloDealer is the #1 choice for bicycle dealers
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate("/auth")} 
                className="text-lg px-8"
              >
                Start Free Trial
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                asChild
              >
                <Link to="/contact">Contact sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
