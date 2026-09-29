import { useRef, useState } from "react";
import { api } from "../auth/api";
import type { AuthUser } from "../auth/store";
import { Icon, PageIntro, Toggle } from "../components/ui";

type Section = "Profile" | "Preferences" | "Privacy" | "Security";

const resizeAvatar = (file: File) => new Promise<string>((resolve, reject) => {
  const source = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) { URL.revokeObjectURL(source); reject(new Error("Could not prepare the photo.")); return; }
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    URL.revokeObjectURL(source);
    resolve(canvas.toDataURL("image/jpeg", 0.82));
  };
  image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("Could not read that image.")); };
  image.src = source;
});

export function SettingsPage({
  user,
  token,
  setToast,
  onLogout,
  onDelete,
  onUserUpdate,
}: {
  user: AuthUser;
  token: string | null;
  setToast: (message: string) => void;
  onLogout: () => void;
  onDelete: () => void;
  onUserUpdate: (user: AuthUser) => void;
}) {
  const [section, setSection] = useState<Section>("Profile");
  const [name, setName] = useState(user.name);
  const [institution, setInstitution] = useState(
    user.profile?.institution ?? "",
  );
  const [course, setCourse] = useState(user.profile?.course ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.profile?.avatarUrl ?? "");
  const [avatarData, setAvatarData] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    user.profile?.theme ?? "system",
  );
  const [language, setLanguage] = useState(user.profile?.language ?? "en");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user.profile?.notificationsEnabled ?? true,
  );
  const [aiEnabled, setAiEnabled] = useState(user.profile?.aiEnabled ?? true);
  const [showReadingActivity, setShowReadingActivity] = useState(
    user.profile?.showReadingActivity ?? true,
  );
  const [saveChatHistory, setSaveChatHistory] = useState(
    user.profile?.saveChatHistory ?? true,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [busy, setBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const identifierLabel =
    user.identifierType === "registration_number"
      ? "Registration number"
      : "Lecturer ID";

  const requireToken = () => {
    if (!token) {
      setToast("Sign in again to save account changes.");
      return false;
    }
    return true;
  };
  const saveProfile = async () => {
    if (!requireToken()) return;
    setBusy(true);
    const result = await api.updateProfile(token!, {
      name,
      institution,
      course,
      avatarUrl: avatarData ? undefined : avatarUrl || undefined,
      avatarData: avatarData || undefined,
    });
    setBusy(false);
    if (!result.ok) return setToast(result.error);
    onUserUpdate(result.data.user);
    setAvatarUrl(result.data.user.profile?.avatarUrl ?? avatarUrl);
    setAvatarData("");
    setToast("Profile saved.");
  };
  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setToast("Choose an image file.");
    try {
      setAvatarData(await resizeAvatar(file));
      setAvatarUrl(URL.createObjectURL(file));
      setToast("Photo selected. Save your profile to upload it.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not prepare the photo.");
    }
  };
  const savePreferences = async () => {
    if (!requireToken()) return;
    setBusy(true);
    const result = await api.updatePreferences(token!, {
      theme,
      language,
      notificationsEnabled,
      aiEnabled,
      showReadingActivity,
      saveChatHistory,
    });
    setBusy(false);
    if (!result.ok) return setToast(result.error);
    onUserUpdate(result.data.user);
    setToast("Preferences saved.");
  };
  const submitPassword = async () => {
    if (!requireToken()) return;
    setBusy(true);
    const result = await api.changePassword(
      token!,
      currentPassword,
      newPassword,
    );
    setBusy(false);
    if (!result.ok) return setToast(result.error);
    setCurrentPassword("");
    setNewPassword("");
    setToast("Password changed. Other sessions were signed out.");
  };
  const requestEmailCode = async () => {
    if (!requireToken()) return;
    setBusy(true);
    const result = await api.requestEmailChange(token!, newEmail);
    setBusy(false);
    setToast(
      result.ok
        ? "Verification code generated in the local backend terminal."
        : result.error,
    );
  };
  const confirmEmail = async () => {
    if (!requireToken()) return;
    setBusy(true);
    const result = await api.confirmEmailChange(token!, emailCode);
    setBusy(false);
    if (!result.ok) return setToast(result.error);
    onUserUpdate(result.data.user);
    setNewEmail("");
    setEmailCode("");
    setToast("Lecturer email updated.");
  };

  const settingsSections: {
    label: Section;
    icon: "users" | "sun" | "archive" | "settings";
  }[] = [
    { label: "Profile", icon: "users" },
    { label: "Preferences", icon: "sun" },
    { label: "Privacy", icon: "archive" },
    { label: "Security", icon: "settings" },
  ];
  return (
    <PageIntro
      eyebrow="ACCOUNT"
      title="Profile & settings"
      copy="Manage your profile, preferences, privacy, and account security."
    >
      <div className="settings-layout expanded-settings">
        <aside className="settings-menu">
          {settingsSections.map((item) => (
            <button
              key={item.label}
              className={section === item.label ? "active" : ""}
              onClick={() => setSection(item.label)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </aside>
        <section className="settings-panel">
          {section === "Profile" && (
            <>
              <div className="settings-profile">
                <span>{avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : initials}</span>
                <div>
                  <h3>{user.name}</h3>
                  <p>
                    {user.identifier} . {user.role}
                  </p>
                </div>
                <button type="button" onClick={() => avatarInputRef.current?.click()}>
                  Change photo
                </button>
                <input ref={avatarInputRef} hidden type="file" accept="image/*" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = "" }} />
              </div>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  {identifierLabel}
                  <input defaultValue={user.identifier} readOnly />
                </label>
                <label>
                  Institution
                  <input
                    value={institution}
                    onChange={(event) => setInstitution(event.target.value)}
                    placeholder="Your institution"
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    placeholder="Your unit"
                  />
                </label>
              </div>
              <button
                className="primary-button settings-save"
                disabled={busy}
                onClick={saveProfile}
              >
                Save profile <Icon name="check" size={16} />
              </button>
            </>
          )}
          {section === "Preferences" && (
            <>
              <div className="settings-heading">
                <h3>Reading preferences</h3>
                <p>Choose how Cresa Space feels and communicates with you.</p>
              </div>
              <div className="form-grid">
                <label>
                  Theme
                  <select
                    value={theme}
                    onChange={(event) =>
                      setTheme(event.target.value as typeof theme)
                    }
                  >
                    <option value="system">System default</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label>
                  Language
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="fr">French</option>
                  </select>
                </label>
              </div>
              <div className="preference-list">
                <div>
                  <div>
                    <strong>Reading reminders</strong>
                    <p>Receive a gentle prompt to continue reading.</p>
                  </div>
                  <Toggle
                    checked={notificationsEnabled}
                    onChange={() =>
                      setNotificationsEnabled(!notificationsEnabled)
                    }
                  />
                </div>
                <div>
                  <div>
                    <strong>AI reading companion</strong>
                    <p>Show study and summary tools inside the reader.</p>
                  </div>
                  <Toggle
                    checked={aiEnabled}
                    onChange={() => setAiEnabled(!aiEnabled)}
                  />
                </div>
              </div>
              <button
                className="primary-button settings-save"
                disabled={busy}
                onClick={savePreferences}
              >
                Save preferences <Icon name="check" size={16} />
              </button>
            </>
          )}
          {section === "Privacy" && (
            <>
              <div className="settings-heading">
                <h3>Privacy controls</h3>
                <p>
                  Choose what Cresa Space retains and shares in the community.
                </p>
              </div>
              <div className="preference-list">
                <div>
                  <div>
                    <strong>Show reading activity</strong>
                    <p>
                      Allow your activity to appear in community
                      recommendations.
                    </p>
                  </div>
                  <Toggle
                    checked={showReadingActivity}
                    onChange={() =>
                      setShowReadingActivity(!showReadingActivity)
                    }
                  />
                </div>
                <div>
                  <div>
                    <strong>Save AI chat history</strong>
                    <p>
                      Keep previous reading-companion conversations in your
                      account.
                    </p>
                  </div>
                  <Toggle
                    checked={saveChatHistory}
                    onChange={() => setSaveChatHistory(!saveChatHistory)}
                  />
                </div>
              </div>
              <button
                className="primary-button settings-save"
                disabled={busy}
                onClick={savePreferences}
              >
                Save privacy controls <Icon name="check" size={16} />
              </button>
            </>
          )}
          {section === "Security" && (
            <>
              <div className="settings-heading">
                <h3>Account security</h3>
                <p>
                  Use a strong password and keep your verified lecturer email
                  current.
                </p>
              </div>
              <div className="security-section">
                <h4>Change password</h4>
                <label>
                  Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={submitPassword}
                >
                  Update password
                </button>
              </div>
              {user.role === "lecturer" && (
                <div className="security-section">
                  <h4>Change lecturer email</h4>
                  <p>Current email: {user.lecturerEmail ?? "Not available"}</p>
                  <label>
                    New lecturer email
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      placeholder="lecturer@university.edu"
                    />
                  </label>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={requestEmailCode}
                  >
                    Generate verification code
                  </button>
                  <label>
                    Six-digit code
                    <input
                      value={emailCode}
                      onChange={(event) =>
                        setEmailCode(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      placeholder="000000"
                    />
                  </label>
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={confirmEmail}
                  >
                    Confirm new email
                  </button>
                </div>
              )}
              <div className="account-actions">
                <button onClick={onLogout}>Sign out of this device</button>
                <button onClick={onDelete}>Request account deletion</button>
              </div>
            </>
          )}
        </section>
      </div>
    </PageIntro>
  );
}
