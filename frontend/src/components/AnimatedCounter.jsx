import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * Count-up animation that ticks from 0 to the target value.
 * Only fires once when the element scrolls into view.
 *
 * @param {number} value   — target value
 * @param {function} format — optional formatter (receives the raw number)
 * @param {number} duration — animation duration in seconds (default 1.2)
 */
export default function AnimatedCounter({ value, format, duration = 1.2, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(format ? format(0) : "0");

  useEffect(() => {
    if (!inView || value == null || isNaN(value)) return;

    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        setDisplay(format ? format(v) : Math.round(v).toLocaleString());
      },
    });

    return () => controls.stop();
  }, [inView, value, format, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
