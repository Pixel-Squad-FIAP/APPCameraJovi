export default function SectionHeading({ eyebrow, title, intro, id }) {
  return (
    <div className="mb-8">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-[#b2c7d8]">{eyebrow}</p>
      <h2 id={id} className="max-w-[740px] text-[clamp(1.55rem,4.6vw,2.45rem)] font-bold leading-[1.12] text-[#f0f0ec]">
        {title}
      </h2>
      {intro && <p className="mt-4 max-w-[660px] text-[#bec4c8]">{intro}</p>}
    </div>
  );
}
