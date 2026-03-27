import React from "react";

type Variant = "solid" | "outline" | "flat" | "circle";
type Size = number;

interface PkrIconProps extends React.SVGProps<SVGSVGElement> {
    /** Icon size in px (width & height). Default: 24 */
    size?: Size;
    /** Visual style of the icon. Default: "solid" */
    variant?: Variant;
    /** Primary color (fill/stroke). Default: "#1a7f4b" */
    color?: string;
    /** Symbol color for solid/circle variants. Default: "#ffffff" */
    symbolColor?: string;
    /** Corner radius for solid/outline variants. Default: auto (size / 6.5) */
    radius?: number;
}

const PakistaniRupeeIcon: React.FC<PkrIconProps> = ({
    size = 24,
    variant = "flat",
    color = "currentColor",
    // color = "#1a7f4b",
    symbolColor = "#ffffff",
    radius,
    ...svgProps
}) => {
    const r = radius ?? Math.round(size / 6.5);
    const fontSize = size * 0.58;
    const textY = size * 0.72;

    if (variant === "flat") {
        return (
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Pakistani Rupee"
                role="img"
                {...svgProps}
            >
                <text
                    x={size / 2}
                    y={textY}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="serif"
                    fill={"currentColor"}
                >
                    ₨
                </text>
            </svg>
        );
    }

    if (variant === "circle") {
        return (
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Pakistani Rupee"
                role="img"
                {...svgProps}
            >
                <circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
                <text
                    x={size / 2}
                    y={textY}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="serif"
                    fill={symbolColor}
                >
                    ₨
                </text>
            </svg>
        );
    }

    if (variant === "outline") {
        return (
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Pakistani Rupee"
                role="img"
                {...svgProps}
            >
                <rect
                    x={1}
                    y={1}
                    width={size - 2}
                    height={size - 2}
                    rx={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={size * 0.05}
                />
                <text
                    x={size / 2}
                    y={textY}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="serif"
                    fill={color}
                >
                    ₨
                </text>
            </svg>
        );
    }

    // solid (default)
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Pakistani Rupee"
            role="img"
            {...svgProps}
        >
            <rect width={size} height={size} rx={r} fill={color} />
            <text
                x={size / 2}
                y={textY}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight="700"
                fontFamily="serif"
                fill={symbolColor}
            >
                ₨
            </text>
        </svg>
    );
};

export default PakistaniRupeeIcon;