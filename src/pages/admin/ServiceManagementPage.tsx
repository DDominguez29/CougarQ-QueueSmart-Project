import { useEffect, useState } from 'react';
import './ServiceManagementPage.css';

type Service = {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
};

type ServiceForm = {
  name: string;
  description: string;
  expectedDurationMinutes: string;
  priority: string;
};

type ApiErrorResponse = {
  error?: {
    code: string;
    message: string;
  };
};

const emptyForm: ServiceForm = {
  name: '',
  description: '',
  expectedDurationMinutes: '',
  priority: '',
};

function ServiceManagementPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [formData, setFormData] = useState<ServiceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchServices();
  }, []);

  async function fetchServices() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/services');

      if (!response.ok) {
        const result = (await response.json()) as ApiErrorResponse;

        throw new Error(
          result.error?.message ?? 'Unable to load services.',
        );
      }

      const result = (await response.json()) as {
        data: Service[];
      };

      setServices(result.data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load services.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    const expectedDurationMinutes = Number(
      formData.expectedDurationMinutes,
    );

    const priority = Number(formData.priority);

    if (!formData.name.trim()) {
      setError('Service name is required.');
      return;
    }

    if (!formData.description.trim()) {
      setError('Description is required.');
      return;
    }

    if (
      !Number.isFinite(expectedDurationMinutes) ||
      expectedDurationMinutes <= 0
    ) {
      setError('Expected duration must be greater than 0.');
      return;
    }

    if (!Number.isInteger(priority) || priority < 0) {
      setError('Priority must be a non-negative integer.');
      return;
    }

    const serviceData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      expectedDurationMinutes,
      priority,
    };

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const url = isEditing
        ? `/api/services/${editingId}`
        : '/api/services';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData),
      });

      const result = await response.json();

      if (!response.ok) {
        const apiError = result as ApiErrorResponse;

        setError(
          apiError.error?.message ??
            'Unable to save service.',
        );

        return;
      }

      setMessage(
        isEditing
          ? 'Service updated successfully.'
          : 'Service created successfully.',
      );

      setEditingId(null);
      setFormData(emptyForm);

      await fetchServices();
    } catch {
      setError('Unable to connect to the service API.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(service: Service) {
    setEditingId(service.id);

    setFormData({
      name: service.name,
      description: service.description,
      expectedDurationMinutes: String(
        service.expectedDurationMinutes,
      ),
      priority: String(service.priority),
    });

    setMessage('');
    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setFormData(emptyForm);
    setMessage('');
    setError('');
  }

  return (
    <div className="service-page">
      <main className="service-main">
        <section className="service-panel">
          <p className="service-eyebrow">
            SERVICES
          </p>

          <h1>Service Management</h1>

          <p className="service-description">
            Create and update QueueSmart services.
          </p>

          {message && (
            <p className="service-message service-message--success">
              {message}
            </p>
          )}

          {error && (
            <p className="service-message service-message--error">
              {error}
            </p>
          )}

          <form
            className="service-form"
            onSubmit={handleSubmit}
          >
            <label>
              Service Name
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                maxLength={100}
                placeholder="Example: Book Pickup"
                required
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                maxLength={500}
                placeholder="Describe the service"
                required
              />
            </label>

            <label>
              Expected Duration (minutes)
              <input
                type="number"
                name="expectedDurationMinutes"
                value={formData.expectedDurationMinutes}
                onChange={handleChange}
                min="1"
                placeholder="15"
                required
              />
            </label>

            <label>
              Priority
              <input
                type="number"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                min="0"
                step="1"
                placeholder="Example: 1"
                required
              />
            </label>

            <p className="service-description">
              Higher priority numbers are ranked first.
            </p>

            <div className="service-form__actions">
              <button
                type="submit"
                className="service-submit-button"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId !== null
                    ? 'Update Service'
                    : 'Create Service'}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  className="service-cancel-button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="service-panel">
          <p className="service-eyebrow">
            CURRENT SERVICES
          </p>

          <h2>Service List</h2>

          {loading ? (
            <p className="service-description">
              Loading services...
            </p>
          ) : services.length === 0 ? (
            <p className="service-description">
              No services have been created yet.
            </p>
          ) : (
            <div className="service-list">
              {services.map((service) => (
                <article
                  className="service-card"
                  key={service.id}
                >
                  <div className="service-card__content">
                    <div className="service-card__heading">
                      <h3>{service.name}</h3>

                      <span className="service-priority">
                        Priority {service.priority}
                      </span>
                    </div>

                    <p>{service.description}</p>

                    <p>
                      <strong>Expected Duration:</strong>{' '}
                      {service.expectedDurationMinutes} minutes
                    </p>
                  </div>

                  <button
                    type="button"
                    className="service-edit-button"
                    onClick={() => handleEdit(service)}
                  >
                    Edit
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ServiceManagementPage;