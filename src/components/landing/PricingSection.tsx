import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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

const tiers = [
  {
    name: "Community",
    price: "MIT",
    subtitle: null,
    featured: false,
    features: [
      "Self-host the full Vite app",
      "Bring your own Supabase project",
      "Owner, stylist, and client dashboards",
      "Setup doctor and deployment docs",
    ],
  },
  {
    name: "BYO Providers",
    price: "Your keys",
    subtitle: null,
    featured: true,
    features: [
      "Stripe payments and memberships",
      "Gemini AI consultation and try-on",
      "ElevenLabs voice receptionist",
      "Twilio SMS and phone workflows",
      "Resend email and Google profile sync",
    ],
  },
  {
    name: "Operators",
    price: "Self-managed",
    subtitle: null,
    featured: false,
    features: [
      "Run one salon or many",
      "Own your database and client records",
      "Customize legal, brand, and providers",
      "Deploy to any static host",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32 px-4">
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
            Open Source
          </p>
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight mb-4">
            Free software, bring your own infrastructure
          </h2>
          <p className="text-muted-foreground text-lg font-light max-w-xl mx-auto">
            No hosted Prism subscription is required. Run it yourself with your own keys.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              className={`relative flex flex-col rounded-xl p-7 ${
                tier.featured
                  ? "glass-elevated border-primary/30 shadow-lg shadow-prism/10"
                  : "glass"
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              custom={i + 1}
            >
              {tier.featured && (
                <span className="badge-prism rounded-full absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1">
                  Recommended Setup
                </span>
              )}
              <h3 className="text-xl font-medium mb-1">{tier.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-light">{tier.price}</span>
                {tier.subtitle && (
                  <span className="text-muted-foreground text-sm font-light">
                    {tier.subtitle}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-glass-teal mt-0.5 shrink-0" />
                    <span className="font-light">{feature}</span>
                  </li>
                ))}
              </ul>

              {tier.featured ? (
                <Button
                  asChild
                  className="w-full bg-gradient-prism text-white rounded-full border-0 shadow-lg shadow-prism/20 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"
                >
                  <Link to="/signup">Create Salon</Link>
                </Button>
              ) : (
                <Link to="/signup" className="glass rounded-full w-full py-2.5 text-sm font-medium hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 block text-center">
                  Create Salon
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
