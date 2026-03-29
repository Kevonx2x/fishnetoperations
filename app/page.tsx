"use client";

import { useState } from "react";
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  MoreHorizontal,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Types
interface Agent {
  id: number;
  name: string;
  company: string;
  companyLogo?: string;
  score: number;
  closings: number;
  responseTime: number;
  expertise?: number;
  negotiation?: number;
  availability: string;
  availabilityType: "now" | "today" | "tomorrow";
  image: string;
}

interface Property {
  id: number;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image: string;
}

// Data
const agents: Agent[] = [
  {
    id: 1,
    name: "Sarah Reyes",
    company: "RE/MAX",
    score: 95,
    closings: 360,
    responseTime: 97,
    expertise: 91,
    availability: "Available Now",
    availabilityType: "now",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
  },
  {
    id: 2,
    name: "James Santos",
    company: "Ayala Land Premier",
    companyLogo: "DAMAX",
    score: 92,
    closings: 340,
    responseTime: 91,
    availability: "Today 5:00 PM",
    availabilityType: "today",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  },
  {
    id: 3,
    name: "Mia Tan",
    company: "Filinvest",
    score: 89,
    closings: 335,
    responseTime: 87,
    negotiation: 89,
    availability: "Tomorrow",
    availabilityType: "tomorrow",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
  },
];

const properties: Property[] = [
  {
    id: 1,
    location: "Forbes Park",
    price: "₱52M+",
    sqft: "4,200",
    beds: 5,
    baths: 5,
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&h=300&fit=crop",
  },
  {
    id: 2,
    location: "Dasmariñas Village",
    price: "₱150M+",
    sqft: "8,500",
    beds: 7,
    baths: 8,
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
  },
  {
    id: 3,
    location: "Alabang Hills",
    price: "₱68M+",
    sqft: "5,800",
    beds: 6,
    baths: 6,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
  },
  {
    id: 4,
    location: "Ayala Alabang",
    price: "₱90M-",
    sqft: "6,200",
    beds: 6,
    baths: 7,
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
  },
];

function LeadForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    property_interest: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: supabaseError } = await supabase
      .from("leads")
      .insert([{ ...form, status: "new" }]);

    if (supabaseError) {
      setError(supabaseError.message || "An error occurred while submitting your request.");
    } else {
      setSuccess(true);
      setForm({
        name: "",
        email: "",
        phone: "",
        property_interest: "",
        message: "",
      });
    }

    setLoading(false);
  };

  return (
    <section className="px-4 pt-8 pb-8">
      <h2 className="text-lg font-bold text-foreground mb-1">
        Request a Viewing
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        An agent will contact you within 24 hours.
      </p>

      {success && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          ✅ Request sent! An agent will contact you shortly.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          placeholder="Full Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          required
          type="email"
          placeholder="Email Address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          placeholder="Phone Number"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <input
          placeholder="Property Interest (e.g. Forbes Park)"
          value={form.property_interest}
          onChange={(e) =>
            setForm({ ...form, property_interest: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <textarea
          placeholder="Message (optional)"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-sage resize-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-sage py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Request Viewing"}
        </button>
      </form>
    </section>
  );
}

export default function MaddenRealEstate() {
  const [activeTab, setActiveTab] = useState<"properties" | "agents">(
    "properties",
  );
  const [agentFilter, setAgentFilter] = useState("top");
  const [currentAgentSlide, setCurrentAgentSlide] = useState(0);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-md bg-cream pb-8">
        <header className="px-4 pt-4">
          <nav className="flex items-center gap-4 rounded-full bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm border border-border/50">
            <button
              onClick={() => setActiveTab("properties")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "properties"
                  ? "bg-sage/20 text-sage-dark"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`rounded-lg p-1.5 ${activeTab === "properties" ? "bg-sage/30" : "bg-muted"}`}
              >
                <Home className="h-4 w-4" />
              </div>
              Properties
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`text-sm font-medium transition-all ${
                activeTab === "agents"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Agents
            </button>
          </nav>
        </header>

        <section className="px-4 pt-4">
          <div className="relative overflow-hidden rounded-2xl">
            <Image
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop"
              alt="Luxury property in Makati"
              width={800}
              height={600}
              className="h-72 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-sm text-cream/90">Makati, Metro Manila</p>
              <p className="text-2xl font-bold text-cream">₱88,500,000</p>
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-cream/90">
              <span>5,200 SQFT</span>
              <span className="text-cream/50">|</span>
              <span>6 BED</span>
              <span className="text-cream/50">|</span>
              <span>6 BATH</span>
            </div>
          </div>
        </section>

        <section className="px-4 pt-6">
          <div className="flex items-center gap-6 border-b border-border">
            <button
              onClick={() => setAgentFilter("top")}
              className={`relative pb-3 text-sm font-medium transition-all ${
                agentFilter === "top"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Top Agents
              {agentFilter === "top" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage" />
              )}
            </button>
            <button
              onClick={() => setAgentFilter("viewing")}
              className={`flex items-center gap-1 pb-3 text-sm font-medium transition-all ${
                agentFilter === "viewing"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Next Available Viewing
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAgentFilter("recommended")}
              className={`flex items-center gap-1 pb-3 text-sm font-medium transition-all ${
                agentFilter === "recommended"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Recommended
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="px-4 pt-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {agents.map((agent) => (
              <AgentCardCompact key={agent.id} agent={agent} />
            ))}
          </div>
        </section>

        <section className="px-4 pt-4 space-y-3">
          {agents.map((agent) => (
            <AgentCardExpanded key={agent.id} agent={agent} />
          ))}
        </section>

        <div className="flex items-center justify-center gap-2 pt-4">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-3" />
            Previous
          </button>
          <div className="flex gap-1.5 mx-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <button
                key={i}
                className={`h-2 w-2 rounded-full transition-all ${
                  i === currentAgentSlide ? "bg-sage w-4" : "bg-sage/30"
                }`}
                onClick={() => setCurrentAgentSlide(i)}
              />
            ))}
          </div>
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Next
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-3" />
          </button>
        </div>

        <section className="pt-6">
          <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
          <div className="flex items-center justify-between px-4 pt-2">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <LeadForm />
      </div>
    </div>
  );
}

function AgentCardCompact({ agent }: { agent: Agent }) {
  return (
    <div className="flex-shrink-0 w-44 rounded-xl bg-card border border-border/50 p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="relative">
          <Image
            src={agent.image}
            alt={agent.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-sage text-xs font-bold text-primary-foreground">
            {agent.score}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground truncate">
              {agent.name}
            </p>
            <button className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">{agent.company}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{agent.closings}</span>
        <span>{agent.responseTime}</span>
        <span>{agent.expertise || agent.negotiation}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[8px] text-muted-foreground/70">
        <span>Closings</span>
        <span>Response Time</span>
        <span>{agent.expertise ? "Expertise" : "Negotiation"}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`text-[10px] font-medium ${
            agent.availabilityType === "now"
              ? "text-sage-dark"
              : "text-muted-foreground"
          }`}
        >
          {agent.availability}
        </span>
        {agent.availabilityType === "today" && (
          <Info className="h-3 w-3 text-sage" />
        )}
        {(agent.availabilityType === "now" ||
          agent.availabilityType === "tomorrow") && (
          <span className="rounded-full bg-sage px-2 py-0.5 text-[8px] font-medium text-primary-foreground">
            COMPARE
          </span>
        )}
      </div>
    </div>
  );
}

function AgentCardExpanded({ agent }: { agent: Agent }) {
  const getButtonStyle = (type: Agent["availabilityType"]) => {
    switch (type) {
      case "now":
        return "bg-sage text-primary-foreground";
      default:
        return "bg-cream-dark text-foreground border border-border";
    }
  };

  const getButtonText = (agent: Agent) => {
    switch (agent.availabilityType) {
      case "now":
        return "Available Now";
      case "today":
        return `Today ${agent.availability.replace("Today ", "")} >`;
      case "tomorrow":
        return "+ 12 More >";
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border/50 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <span className="absolute -top-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-sage text-xs font-bold text-primary-foreground shadow-sm">
            {agent.score}
          </span>
          <Image
            src={agent.image}
            alt={agent.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg object-cover"
          />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">{agent.name}</p>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{agent.closings} Closings</span>
            <span>{agent.responseTime}</span>
            <span>{agent.expertise || agent.negotiation}</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70">
            <span></span>
            <span>Response Time</span>
            <span>{agent.expertise ? "Luxury" : "Negotiation"}</span>
          </div>
        </div>
      </div>
      <button
        className={`mt-3 w-full rounded-full py-2.5 text-sm font-medium transition-all ${getButtonStyle(agent.availabilityType)}`}
      >
        {getButtonText(agent)}
      </button>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="flex-shrink-0 w-36 overflow-hidden rounded-xl shadow-sm">
      <div className="relative">
        <Image
          src={property.image}
          alt={property.location}
          width={144}
          height={108}
          className="h-24 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-sm font-bold text-cream">{property.price}</p>
        </div>
      </div>
    </div>
  );
}
