"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { faqs } from "@/lib/pravrutti-data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Mail } from "lucide-react";

export default function FAQPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#000000] overflow-x-hidden text-[#F7EEE4] flex flex-col justify-between">
      <Navigation />

      {/* Grid overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-[#721F4C]/40"
            style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-[#4A1C3A]/40"
            style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
          />
        ))}
      </div>

      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 z-[1] pointer-events-none crt-scanlines opacity-25" />

      <div className="relative z-10 flex-1 w-full max-w-[1000px] mx-auto px-6 py-32 lg:py-40">
        {/* Header */}
        <div className={`mb-16 text-center transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="inline-flex items-center gap-3 text-xs font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-6 mx-auto">
            <span className="w-8 h-px bg-[#721F4C]" />
            FAQS ARCHIVE
          </span>
          <h1 className="text-4xl md:text-7xl font-orbitron tracking-wider text-[#F7EEE4] mb-6 font-black">
            FREQUENTLY ASKED <span className="text-stroke">QUESTIONS</span>
          </h1>
          <p className="text-base md:text-xl text-[#F7EEE4]/70 leading-relaxed max-w-2xl mx-auto font-sharetech">
            Access the help logs. Find answers regarding entry coins, level venues, rules updates, and certificates.
          </p>
        </div>

        {/* Accordions inside cyber-box frames */}
        <div className="space-y-4 mb-16">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="border border-[#4A1C3A] rounded-2xl bg-[#150B1E]/60 backdrop-blur-md px-6 py-2 overflow-hidden transition-all duration-300 data-[state=open]:border-[#D64D8D] cyber-box"
              >
                <AccordionTrigger className="text-left font-orbitron text-base md:text-lg text-[#F7EEE4] hover:text-[#F2D2AE] hover:no-underline font-extrabold py-4">
                  <div className="flex items-center gap-3 tracking-wide">
                    <span className="text-xs font-mono text-[#D64D8D] font-bold">L{index + 1}.</span>
                    {faq.question}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs md:text-sm text-[#F7EEE4]/70 leading-relaxed pb-4 pt-2 font-sharetech">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Help Box in cyber-box bezel */}
        <div className="p-8 border border-[#721F4C] bg-[#150B1E]/80 backdrop-blur-md rounded-3xl text-center max-w-xl mx-auto space-y-4 shadow-2xl shadow-[#721F4C]/25 cyber-box font-orbitron">
          <div className="w-12 h-12 rounded-2xl bg-[#721F4C]/40 text-[#F2D2AE] flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#F7EEE4] tracking-wide">Still Have Questions?</h3>
          <p className="text-xs text-[#F7EEE4]/60 max-w-md mx-auto font-sharetech">
            If you couldn't find an answer to your query, reach out directly to the core organizing committee.
          </p>
          <a
            href="mailto:pravrutti@msruas.ac.in"
            className="inline-block text-sm font-bold text-[#F2D2AE] underline hover:text-white transition-colors"
          >
            pravrutti@msruas.ac.in &rarr;
          </a>
        </div>
      </div>

      <FooterSection />
    </main>
  );
}
