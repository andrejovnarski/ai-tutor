import { redirect } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { AVATARS, GRADES, KID_ERRORS } from "@/server/kidProfile";
import { addKid } from "../../actions";

export default async function NewKidPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireParent();
  const { data: parent } = await supabase.from("parents").select("consent_at").eq("id", user.id).single();
  if (!parent?.consent_at) redirect("/parent");
  const { error } = await searchParams;
  const message =
    error === "nickname" || error === "grade" || error === "avatar"
      ? KID_ERRORS[error]
      : error
        ? "We could not save that. Please try again."
        : undefined;
  return (
    <main>
      <h1>Add kid</h1>
      {message && <p role="alert">{message}</p>}
      <form action={addKid}>
        <label>
          First name only
          <input name="nickname" required maxLength={40} autoComplete="off" />
        </label>
        <label>
          Grade
          <select name="grade" defaultValue="K">
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Avatar</legend>
          {AVATARS.map((a, i) => (
            <label key={a}>
              <input type="radio" name="avatar" value={a} defaultChecked={i === 0} />
              {a}
            </label>
          ))}
        </fieldset>
        <button type="submit">Save</button>
      </form>
    </main>
  );
}
