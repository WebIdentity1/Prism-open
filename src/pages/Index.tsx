import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ScanFace,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  BarChart3,
  MessageSquare,
  Star,
  Globe,
} from "lucide-react";
import { PricingSection } from "@/components/landing/PricingSection";
import { ConsultationQueueMock } from "@/components/landing/ConsultationQueueMock";
import { TryOnPreviewMock } from "@/components/landing/TryOnPreviewMock";
import { EmailBuilderMock } from "@/components/landing/EmailBuilderMock";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const businessFeatures = [
  {
    icon: Calendar,
    title: "Smart Booking",
    description:
      "Online booking, walk-ins, staff calendars. Clients book directly, you manage from one screen.",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: DollarSign,
    title: "Payroll & Commissions",
    description:
      "Flat rate, sliding scale, hourly, or greater-of. Flexible pay models that match how your shop works.",
    iconColor: "text-glass-teal",
    iconBg: "bg-glass-teal/10",
  },
  {
    icon: BarChart3,
    title: "Revenue Analytics",
    description:
      "Track revenue, retention, top services, stylist performance, and busiest hours. Export to CSV anytime.",
    iconColor: "text-champagne",
    iconBg: "bg-champagne/10",
  },
  {
    icon: MessageSquare,
    title: "Marketing Campaigns",
    description:
      "Email and SMS to targeted segments. Bring back lapsed clients, fill slow days, promote specials.",
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: Star,
    title: "Loyalty & Memberships",
    description:
      "Points, rewards, referrals, and membership tiers with Stripe billing. Keep clients coming back.",
    iconColor: "text-glass-teal",
    iconBg: "bg-glass-teal/10",
  },
  {
    icon: Globe,
    title: "Google Business Sync",
    description:
      "Sync and reply to Google reviews from your dashboard. Manage your online reputation in one place.",
    iconColor: "text-champagne",
    iconBg: "bg-champagne/10",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-subtle backdrop-blur-lg border-b border-border/30">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-prism rounded-md rotate-45" />
            <span className="text-lg font-medium tracking-tight text-foreground">
              Prism
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a
              href="#features"
              className="text-foreground/60 hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-foreground/60 hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-foreground/60 hover:text-foreground transition-colors"
            >
              Open Source
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full border border-border/50"
              asChild
            >
              <Link to="/login">Log in</Link>
            </Button>
            <Button
              size="sm"
              className="bg-gradient-prism text-white rounded-full shadow-lg shadow-prism/20 border-0"
              asChild
            >
              <Link to="/signup">Create Salon</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — split layout */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-4 overflow-hidden">
        <div className="absolute inset-0 glow-prism pointer-events-none" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left — copy */}
            <div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={0}
              >
                <span className="ai-badge mb-6">
                  <span className="ai-pulse" />
                  AI-Powered Salon Management
                </span>
              </motion.div>

              <motion.h1
                className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[0.95] mb-6"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={1}
              >
                Know what they want{" "}
                <span className="text-primary font-normal italic">
                  before the first cut.
                </span>
              </motion.h1>

              <motion.p
                className="text-lg text-muted-foreground font-light max-w-lg mb-10 leading-relaxed"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={2}
              >
                Clients try on styles with AI before they walk in. You see
                exactly what they want. No more guessing, no more &quot;a little
                shorter.&quot; Just confident cuts and happy clients.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-start gap-4"
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={3}
              >
                <Button
                  size="lg"
                  className="bg-gradient-prism text-white rounded-full px-8 py-4 text-base font-medium shadow-lg shadow-prism/25 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 border-0 h-auto"
                  asChild
                >
                  <Link to="/signup">Create Your Salon</Link>
                </Button>
                <a
                  href="#features"
                  className="glass rounded-full px-8 py-4 text-base font-medium hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 inline-block"
                >
                  See the AI in Action
                </a>
              </motion.div>
            </div>

            {/* Right — product mockup */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="hidden md:block"
            >
              <ConsultationQueueMock />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <p className="text-xs tracking-[4px] uppercase text-champagne font-medium mb-4">
              How It Works
            </p>
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-4">
              Three steps to zero guesswork
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                step: "01",
                title: "Send your consultation link",
                desc: "Share a branded link with new clients. They upload a selfie and AI analyzes their face shape and features.",
                visual: (
                  <div className="bg-obsidian/80 rounded-lg p-3 mb-4 text-center">
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Share consultation link
                    </p>
                    <div className="bg-primary/10 border border-primary/20 rounded px-3 py-1.5">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        prism.salon/consult/yourshop
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                step: "02",
                title: "They try on styles",
                desc: "AI-powered virtual try-on shows them realistic previews of recommended looks. They pick their favorite and book.",
                visual: (
                  <div className="mb-4">
                    <TryOnPreviewMock />
                  </div>
                ),
              },
              {
                step: "03",
                title: "You see their vision",
                desc: "The consultation lands in your dashboard before the appointment. You know exactly what to do when they sit down.",
                visual: (
                  <div className="bg-obsidian/80 rounded-lg p-3 mb-4 text-[10px]">
                    <p className="text-glass-teal mb-1">Next client: 2:30 PM</p>
                    <p className="text-foreground font-semibold">Marcus T.</p>
                    <p className="text-muted-foreground mt-0.5">
                      Mid fade + textured crop
                    </p>
                    <p className="text-primary mt-1">View try-on image →</p>
                  </div>
                ),
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="glass rounded-xl p-7 text-center overflow-hidden"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i + 1}
              >
                {item.visual}
                <div className="text-4xl font-light text-primary/20 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-medium mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section id="features" className="py-20 md:py-36 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <p className="text-xs tracking-[4px] uppercase text-champagne font-medium mb-4">
              AI That Works For You
            </p>
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-4">
              Your shop, supercharged
            </h2>
            <p className="text-muted-foreground text-lg font-light max-w-xl mx-auto">
              AI tools built specifically for hair professionals.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <motion.div
              className="glass rounded-xl p-7 bg-primary/[0.03] border-primary/10 md:row-span-2"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={1}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-medium">Virtual Try-On</h3>
              </div>
              <p className="text-sm text-muted-foreground font-light leading-relaxed mb-6">
                Clients see themselves with any style using AI. They arrive
                knowing exactly what they want.
              </p>
              <TryOnPreviewMock />
            </motion.div>

            <motion.div
              className="glass rounded-xl p-7 bg-primary/[0.03] border-primary/10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={2}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <ScanFace className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-base font-medium">Face Shape Analysis</h3>
              </div>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                AI detects face shape and recommends styles that complement each
                client&apos;s unique features.
              </p>
            </motion.div>

            <motion.div
              className="glass rounded-xl p-7 bg-glass-teal/[0.03] border-glass-teal/10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={3}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-glass-teal/15 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-glass-teal" />
                </div>
                <h3 className="text-base font-medium">AI Receptionist</h3>
              </div>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                Never miss a call again. AI answers the phone 24/7, books
                appointments, and answers client questions.
              </p>
            </motion.div>
          </div>

          <motion.div
            className="glass rounded-xl p-7 bg-glass-teal/[0.03] border-glass-teal/10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeUp}
            custom={4}
          >
            <div className="flex flex-col md:flex-row gap-6 md:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-glass-teal/15 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-glass-teal" />
                  </div>
                  <h3 className="text-base font-medium">AI Campaign Builder</h3>
                </div>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  Describe what you want to say, AI writes branded emails and
                  texts. Fill slow days, bring back lapsed clients.
                </p>
              </div>
              <EmailBuilderMock />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Business Management */}
      <section className="py-16 md:py-28 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <p className="text-xs tracking-[4px] uppercase text-champagne font-medium mb-4">
              Everything Else You Need
            </p>
            <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-4">
              Run your entire shop in one place
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {businessFeatures.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group glass rounded-xl p-7 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-200"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <div
                  className={`w-8 h-8 rounded-lg ${feature.iconBg} flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`h-4 w-4 ${feature.iconColor}`} />
                </div>
                <h3 className="text-base font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 md:py-40 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            className="flex flex-col sm:flex-row justify-center gap-12 sm:gap-16 mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div>
              <p className="text-4xl md:text-5xl font-light text-primary">
                500+
              </p>
              <p className="text-sm text-muted-foreground font-light mt-1">
                Salons &amp; Barbershops
              </p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-light text-glass-teal">
                50K+
              </p>
              <p className="text-sm text-muted-foreground font-light mt-1">
                Consultations Completed
              </p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-light text-champagne">
                98%
              </p>
              <p className="text-sm text-muted-foreground font-light mt-1">
                Client Satisfaction
              </p>
            </div>
          </motion.div>

          <motion.blockquote
            className="max-w-2xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={1}
          >
            <p className="text-lg md:text-xl text-foreground/80 font-light italic leading-relaxed mb-4">
              &quot;Since adding the AI consultation, miscommunication
              complaints dropped to basically zero. Clients show up excited
              because they already know what they&apos;re getting.&quot;
            </p>
            <cite className="text-sm text-muted-foreground not-italic">
              — Salon owner, Los Angeles
            </cite>
          </motion.blockquote>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* CTA */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            className="relative glass-elevated rounded-3xl p-10 md:p-16 text-center overflow-hidden bg-gradient-to-br from-obsidian-800 via-obsidian to-obsidian-900"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            custom={0}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--prism)/0.3),transparent_60%)]" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-4 text-pearl">
                Ready to run it yourself?
              </h2>
              <p className="text-pearl/70 text-lg font-light mb-8 max-w-lg mx-auto">
                Clone the repo, add your provider keys, and own the salon stack end to end.
              </p>
              <Button
                size="lg"
                className="bg-gradient-champagne text-obsidian rounded-full px-8 h-12 text-base font-medium shadow-lg hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 border-0"
                asChild
              >
                <Link to="/signup">Create Your Salon</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-gradient-prism rounded-md rotate-45" />
            <span className="font-medium text-gradient-brand">Prism</span>
          </div>
          <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
            &copy; {new Date().getFullYear()} Prism contributors. MIT licensed.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
