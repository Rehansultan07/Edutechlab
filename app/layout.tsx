import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata={title:"EduTechLab — Modern Education Management Platform",description:"Run your school, coaching institute or madrasa with one modern education management platform."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}