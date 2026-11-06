import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users
} from "lucide-react";

import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import { formatDate, initials } from "../utils/format";

const emptyForm = { name: "", email: "", password: "" };

export default function StaffSettingsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const { data } = await api.get("/staff");
      setMembers(data.members || []);
      setLoadError("");
    } catch (error) {
      if (error?.response?.status === 401) return;
      setLoadError(getErrorMessage(error, "Could not load your team."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const openEditor = () => {
    setForm(emptyForm);
    setFormError("");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
  };

  const createMember = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) return setFormError("Enter the person's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setFormError("Enter a valid email address.");
    }
    if (form.password.length < 8) return setFormError("Password must be at least 8 characters.");
    if (form.password.length > 72) return setFormError("Password must be 72 characters or fewer.");

    setSaving(true);

    try {
      const { data } = await api.post("/staff", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password
      });

      setMembers((current) => [...current, data.member]);
      setEditorOpen(false);
      setForm(emptyForm);
      toast("Staff account created.");
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not create this staff account."));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (member) => {
    const nextActive = member.isActive === false;

    if (!nextActive && !window.confirm(`Deactivate ${member.name}? They will be signed out immediately.`)) {
      return;
    }

    setBusyId(member.id);

    try {
      const { data } = await api.put(`/staff/${member.id}`, { isActive: nextActive });
      setMembers((current) => current.map((item) => (item.id === data.member.id ? data.member : item)));
      toast(nextActive ? "Staff member reactivated." : "Staff member deactivated.");
    } catch (error) {
      toast(getErrorMessage(error, "Could not update this staff member."), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-grid">
      <div className="settings-main">
        {loadError ? (
          <div className="notice notice--danger">
            <AlertTriangle size={17} />
            <p>{loadError}</p>
          </div>
        ) : null}

        <section className="card settings-card">
          <div className="settings-card__head">
            <span className="settings-card__icon"><Users size={18} /></span>
            <div>
              <h3>Your team</h3>
              <p>Owners manage settings, pricing, and team access. Staff can serve customers and process orders.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={openEditor}>
              <UserPlus size={16} /> Add staff
            </button>
          </div>

          <div className="permission-grid">
            <div>
              <ShieldCheck size={16} />
              <strong>Owner</strong>
              <p>Full access, including AI, team, and product changes.</p>
            </div>
            <div>
              <UserCheck size={16} />
              <strong>Staff</strong>
              <p>Dashboard, orders, customers, conversations, and read-only catalogue.</p>
            </div>
          </div>

          <div className="table-wrap">
            {loading && !members.length ? (
              <div className="skeleton-list skeleton-list--padded">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="skeleton skeleton--row" key={index} />
                ))}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isSelf = member.id === user?.id;
                    const active = member.isActive !== false;

                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="table-person">
                            <span className="avatar avatar--xs">{initials(member.name)}</span>
                            <div>
                              <strong>{member.name}{isSelf ? " (you)" : ""}</strong>
                              <span>{member.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`chip chip--${member.role === "owner" ? "violet" : "soft"}`}>
                            {member.role === "owner" ? "Owner" : "Staff"}
                          </span>
                        </td>
                        <td>
                          <span className={`chip chip--${active ? "success" : "neutral"}`}>
                            {active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td>{formatDate(member.createdAt)}</td>
                        <td>
                          {member.role === "owner" ? null : (
                            <button
                              type="button"
                              className={`btn btn-sm ${active ? "btn-ghost btn-ghost--danger" : "btn-secondary"}`}
                              onClick={() => setActive(member)}
                              disabled={busyId === member.id}
                            >
                              {busyId === member.id ? (
                                <Loader2 size={14} className="spin" />
                              ) : active ? (
                                <UserX size={14} />
                              ) : (
                                <UserCheck size={14} />
                              )}
                              {active ? "Deactivate" : "Reactivate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="settings-actions settings-actions--inline">
            <div>
              <strong>Access changes apply immediately</strong>
              <p>Deactivating a staff member revokes their refresh token and signs out current sessions.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </section>
      </div>

      <aside className="settings-side">
        <section className="card tips-card">
          <span className="settings-card__icon settings-card__icon--emerald"><ShieldCheck size={16} /></span>
          <h3>Least privilege</h3>
          <ul>
            <li>Give staff their own account instead of sharing the owner login.</li>
            <li>Deactivate immediately when someone leaves your team.</li>
            <li>Change a staff password from the API or recreate the account if it leaks.</li>
          </ul>
        </section>
      </aside>

      <Modal
        open={editorOpen}
        onClose={closeEditor}
        title="Add staff account"
        subtitle="They can sign in immediately with this temporary password."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeEditor} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="staff-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
              {saving ? "Creating…" : "Create account"}
            </button>
          </>
        }
      >
        <form id="staff-form" className="customer-form" onSubmit={createMember}>
          {formError ? (
            <div className="notice notice--danger">
              <AlertTriangle size={17} />
              <p>{formError}</p>
            </div>
          ) : null}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="staffName">Full name</label>
              <input
                id="staffName"
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Team member's name"
                maxLength={80}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="staffEmail">Email address</label>
              <input
                id="staffEmail"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="person@business.com"
                maxLength={254}
                required
              />
            </div>
            <div className="field field--full">
              <label htmlFor="staffPassword">Temporary password</label>
              <input
                id="staffPassword"
                type="text"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <p className="field-hint">Share it securely. Staff can change it with a password reset later.</p>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
