"use client";

import { useGameReducedMotion as useReducedMotion } from "@/contexts/GameExperienceContext";

import React, { useState, useEffect } from 'react';


/**
 * The small gold burst on a correct answer.
 *
 * Each piece gets its own size, fall distance, sideways drift, spin and
 * duration, handed to CSS as custom properties. The previous version gave
 * every particle the same 8px circle and the same straight 100px drop, which
 * at twenty of them read as a glitch rather than a spark.
 *
 * Pieces are emitted from the upper half of the container and drift outwards,
 * so the burst appears to come from the answer the player just tapped rather
 * than raining on the whole screen.
 *
 * Nothing is rendered for a player who has asked for reduced motion. The
 * stylesheet also hides `.star-particle` under that media query, which is the
 * backstop; returning early here is what actually keeps the nodes out of the
 * document.
 */

const StarParticles = ({ count = 20, isEmitting }: { count?: number; isEmitting: boolean }) => {
  const [particles, setParticles] = useState<React.ReactNode[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    // A player who asked for stillness gets stillness. Also clears anything
    // already on screen if the preference changes mid-run.
    if (reduce) {
      setParticles([]);
      return;
    }

    if (isEmitting) {
      const newParticles = Array.from({ length: count }).map((_, i) => {
        // Emitted from the middle band and pushed outwards, so the further a
        // piece starts from centre the harder it drifts that way.
        const left = 20 + Math.random() * 60;
        const drift = (left - 50) * (0.6 + Math.random() * 0.9);
        const style = {
          left: `${left}%`,
          top: `${20 + Math.random() * 30}%`,
          animationDelay: `${Math.random() * 0.28}s`,
          '--sp-size': `${4 + Math.random() * 7}px`,
          '--sp-fall': `${70 + Math.random() * 90}px`,
          '--sp-drift': `${drift}px`,
          '--sp-spin': `${Math.random() * 540 - 270}deg`,
          '--sp-duration': `${0.75 + Math.random() * 0.6}s`,
          // Varying gold shades, so the burst has depth rather than reading as
          // one flat colour.
          backgroundColor: `hsl(45, 65%, ${Math.random() * 20 + 42}%)`,
        } as React.CSSProperties;
        return <div key={i} className="star-particle" style={style} />;
      });
      setParticles(newParticles);

      // Long enough for the slowest piece plus its delay to finish.
      const timer = setTimeout(() => setParticles([]), 1800);
      return () => clearTimeout(timer);
    }
  }, [isEmitting, count, reduce]);

  return <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-20">{particles}</div>;
};

export default StarParticles;
