import { redirect } from "next/navigation";
import { requireParent } from "@/server/parentGate";
import { AVATARS, GRADES, KID_ERRORS } from "@/server/kidProfile";
import { GRADE_HINT } from "../../../about";
import { faceOf } from "../../../avatars";
import { gradeName } from "../../../grades";
import { GrownupFrame } from "../../ui/GrownupFrame";
import styles from "../../ui/grownup.module.css";
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
    <GrownupFrame back={{ href: "/parent", label: "Your kids" }}>
      <h1>Add a child</h1>
      {message && (
        <p role="alert" className={styles.note}>
          {message}
        </p>
      )}
      <form action={addKid}>
        <label className={styles.field}>
          First name only
          <input name="nickname" required maxLength={20} autoComplete="off" className={styles.input} />
        </label>
        <label className={styles.field}>
          Grade
          <select name="grade" defaultValue="K" className={styles.select} aria-describedby="grade-hint">
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeName(g)}
              </option>
            ))}
          </select>
        </label>
        <p id="grade-hint" className={styles.quiet}>{GRADE_HINT}</p>
        <fieldset className={styles.faces}>
          <legend className={styles.legend}>Avatar</legend>
          {AVATARS.map((a, i) => (
            <label key={a} className={styles.faceTile}>
              <input type="radio" name="avatar" value={a} defaultChecked={i === 0} className={styles.visuallyHidden} />
              <span aria-hidden="true" className={styles.faceEmoji}>
                {faceOf(a)}
              </span>
              <span className={styles.faceName}>{a}</span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className={styles.btn}>
          Save
        </button>
      </form>
    </GrownupFrame>
  );
}
