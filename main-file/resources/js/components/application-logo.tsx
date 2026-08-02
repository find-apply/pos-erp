import { ImgHTMLAttributes } from "react";

export default function ApplicationLogo(props: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            src="/brand/dzerp-logo.png"
            alt={props.alt || "DzERP"}
        />
    );
}
