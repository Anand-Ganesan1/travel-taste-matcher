import { motion } from "framer-motion";

interface WizardStepProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export function WizardStep({ children, title, description }: WizardStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-2 text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          {title}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      </div>
      
      <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
        {children}
      </div>
    </motion.div>
  );
}
