import PublicLayout from "@/components/layout/PublicLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { aboutContent } from "@/content/about";
import heroBread from "@/assets/hero-bread.jpg";

const Section = ({ title, body }: { title: string; body: string[] }) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
    <h2 className="font-serif text-3xl sm:text-4xl mb-6" style={{ letterSpacing: "-0.02em" }}>
      {title}
    </h2>
    <div className="space-y-4 text-base sm:text-lg leading-relaxed text-foreground/85">
      {body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  </section>
);

const About = () => {
  return (
    <PublicLayout>
      <div className="relative h-[40vh] sm:h-[55vh] min-h-[320px] overflow-hidden">
        <img src={heroBread} alt="Brood uit de oven" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-10 max-w-3xl mx-auto">
          <p className="bakery-eyebrow mb-3">Bosgoedt Bakery</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-medium leading-[1.0]" style={{ letterSpacing: "-0.025em" }}>
            {aboutContent.hero.title}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-foreground/80 max-w-xl">
            {aboutContent.hero.subtitle}
          </p>
        </div>
      </div>

      <Section title={aboutContent.nikki.title} body={aboutContent.nikki.body} />
      <div className="border-t border-border/60" />
      <Section title={aboutContent.sourdough.title} body={aboutContent.sourdough.body} />
      <div className="border-t border-border/60" />
      <Section title={aboutContent.sweet.title} body={aboutContent.sweet.body} />

      <section className="bg-muted/30 border-t border-border/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl mb-6" style={{ letterSpacing: "-0.02em" }}>
            {aboutContent.cta.title}
          </h2>
          <Button asChild size="lg">
            <Link to="/bestellen">{aboutContent.cta.button} →</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
};

export default About;
