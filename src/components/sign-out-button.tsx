import { Button } from "antd";
import { signOutAction } from "@/app/[locale]/(protected)/actions";

export function SignOutButton({ locale, label }: { locale: string; label: string }) {
  return (
    <form action={signOutAction.bind(null, locale)}>
      <Button htmlType="submit">{label}</Button>
    </form>
  );
}
