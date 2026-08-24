export const servicesCopy = {
  eyebrow: "Services",
  headline: "What we do.",
  items: [
    {
      title: "Creator Campaigns",
      description:
        "A music-led, audience-focused and data-driven approach to matching releases with the right creators.",
      icon: "users" as const,
    },
    {
      title: "Paid Media",
      description:
        "Highly targeted Meta campaigns designed to drive the right listeners to your music, socials and streaming platforms.",
      icon: "megaphone" as const,
    },
    {
      title: "Release Strategy",
      description:
        "Campaign planning built around the artist, audience and release.",
      icon: "target" as const,
    },
    {
      title: "Content & Social",
      description:
        "Short-form content and promotional creative built for music campaigns.",
      icon: "video" as const,
    },
  ],
} as const;

export const processCopy = {
  eyebrow: "Process",
  headline: "How it works.",
  overviewEyebrow: "Overview",
  overviewLede: "A simple process. Real results.",
  steps: [
    {
      number: "01",
      title: "Understand the Music",
      description:
        "We learn the sound, audience and direction of the release.",
    },
    {
      number: "02",
      title: "Understand the Audience",
      description: "We identify who the campaign needs to reach.",
    },
    {
      number: "03",
      title: "Build the Strategy",
      description:
        "We choose the right creators, content and paid media approach.",
    },
    {
      number: "04",
      title: "Launch & Manage",
      description:
        "We launch the campaign and manage it across the selected channels.",
    },
    {
      number: "05",
      title: "Analyse & Optimise",
      description:
        "We use performance data to improve the campaign as it runs.",
    },
  ],
} as const;

export const contactCopy = {
  eyebrow: "Contact",
  headline: "Let's talk about your next release.",
  description:
    "Need full campaign support? We can handle content, marketing, paid media and DSP pitching from start to finish.",
  primaryCta: "Send Enquiry",
  instagramButton: "Instagram",
  availability: "Available for campaign enquiries",
} as const;
