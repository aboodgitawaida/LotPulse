import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-right"
    offset={24}
    mobileOffset={{ bottom: 164 }}
    toastOptions={{
      classNames: {
        toast: "lp-toast",
        description: "lp-toast-description",
        actionButton: "lp-toast-action",
      },
    }}
    {...props}
  />
);

export { Toaster };
