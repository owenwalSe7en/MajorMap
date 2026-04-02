"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Search, BarChart3, CalendarDays } from "lucide-react";

const features = [
  {
    number: "01",
    title: "Browse Programs",
    description:
      "Explore 593+ University of Utah degree programs. Filter by type, search by name, and dive into full requirement breakdowns.",
    icon: GraduationCap,
  },
  {
    number: "02",
    title: "Search Courses",
    description:
      "Find any course across 125 departments. View credit hours, prerequisites, and typical offering schedules.",
    icon: Search,
  },
  {
    number: "03",
    title: "Plan Semesters",
    description:
      "Build your semester-by-semester plan. Drag courses into place and get soft warnings when prerequisites are out of order.",
    icon: CalendarDays,
  },
  {
    number: "04",
    title: "Track Progress",
    description:
      "See how far you are toward graduation. Import your transcript and watch your progress update in real time.",
    icon: BarChart3,
  },
];

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 },
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const Icon = feature.icon;

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10">
        <div className="shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
        </div>
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-24 h-24 rounded-2xl border border-foreground/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Icon className="w-10 h-10 text-foreground/60" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            What you can do
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Plan smarter.
            <br />
            <span className="text-muted-foreground">Graduate faster.</span>
          </h2>
        </div>

        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
