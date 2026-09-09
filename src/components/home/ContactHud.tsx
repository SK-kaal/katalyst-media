function polar(cx: number, cy: number, radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  };
}

function tickLines() {
  const lines = [];
  for (let index = 0; index < 12; index += 1) {
    const from = polar(200, 200, 178, index * 30);
    const to = polar(200, 200, 192, index * 30);
    lines.push(
      <line
        key={index}
        className="contact-hud__tick"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
      />,
    );
  }
  return lines;
}

export function ContactHud() {
  return (
    <svg className="contact-hud" viewBox="0 0 400 400" aria-hidden="true">
      <g className="contact-hud__static">
        <circle className="contact-hud__ring contact-hud__ring--outer" cx="200" cy="200" r="168" />
        <circle className="contact-hud__ring contact-hud__ring--mid" cx="200" cy="200" r="112" />
        {tickLines()}
      </g>
      <g className="contact-hud__spin">
        <circle className="contact-hud__ring contact-hud__ring--dashed" cx="200" cy="200" r="148" />
      </g>
    </svg>
  );
}
