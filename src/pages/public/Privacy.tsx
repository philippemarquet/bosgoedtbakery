import PublicLayout from "@/components/layout/PublicLayout";

const Privacy = () => (
  <PublicLayout>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <p className="bakery-eyebrow mb-3">Bosgoedt Bakery</p>
      <h1 className="font-serif text-4xl sm:text-5xl mb-8" style={{ letterSpacing: "-0.02em" }}>
        Privacyverklaring
      </h1>
      <div className="space-y-4 text-foreground/80 leading-relaxed">
        <p>
          We hechten waarde aan je privacy. Op deze pagina komt binnenkort een uitgebreide
          privacyverklaring waarin we uitleggen welke gegevens we verzamelen en waarvoor we ze
          gebruiken.
        </p>
        <p className="text-sm text-muted-foreground">[TODO: Nikki vult deze pagina aan.]</p>
        <p>
          Vragen? Stuur een mailtje naar{" "}
          <a href="mailto:hallo@bosgoedt.be" className="underline">
            hallo@bosgoedt.be
          </a>
          .
        </p>
      </div>
    </div>
  </PublicLayout>
);

export default Privacy;
