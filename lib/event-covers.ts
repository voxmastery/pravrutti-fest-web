import type { Event } from "@/lib/pravrutti-data";

/**
 * Fallback cover gradient per category, and the ambient glow behind real
 * poster art.
 *
 * Lives here rather than beside the panel that first used it: the poster
 * component and the event page both need it, and importing it from the panel
 * made the panel a dependency of its own poster.
 */
export const COVER_GRADIENTS: Record<Event["category"], string> = {
  "Engineering and Design": "from-neon-purple via-deep-plum to-midnight-navy",
  "Research and Presentation": "from-soft-gold via-royal-wine to-midnight-navy",
  "Code and Compute": "from-cyber-pink via-deep-plum to-midnight-navy",
  "Enterprise and Expression": "from-royal-wine via-cosmic-purple to-midnight-navy",
};
