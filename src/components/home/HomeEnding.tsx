import { Footer } from "@/components/layout/Footer";
import { ContactSection } from "@/components/home/ContactSection";
import "./contact-stage.css";
import "./home-ending.css";

export function HomeEnding() {
  return (
    <div className="home-ending">
      <ContactSection className="home-ending__contact" />
      <Footer className="home-ending__footer" variant="ending" />
    </div>
  );
}
