import { useEffect, useState } from 'react';
<<<<<<< Updated upstream
import './ServiceManagementPage.css';

type Service = {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
=======

import './ServiceManagementPage.css';

type PriorityLevel = 'Low' | 'Normal' | 'High';

type Service = {
  id: number;
  name: string;
  description: string;
  expectedDuration: number;
  priorityLevel: PriorityLevel;
>>>>>>> Stashed changes
};

type ServiceForm = {
  name: string;
  description: string;
<<<<<<< Updated upstream
  expectedDurationMinutes: string;
  priority: string;
};

type ApiErrorResponse = {
  error?: {
    code: string;
    message: string;
  };
=======
  expectedDuration: string;
  priorityLevel: PriorityLevel;
>>>>>>> Stashed changes
};

const emptyForm: ServiceForm = {
  name: '',
  description: '',
<<<<<<< Updated upstream
  expectedDurationMinutes: '',
  priority: '',
=======
  expectedDuration: '',
  priorityLevel: 'Normal',
>>>>>>> Stashed changes
};

function ServiceManagementPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [formData, setFormData] = useState<ServiceForm>(emptyForm);
<<<<<<< Updated upstream
  const [editingId, setEditingId] = useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
=======
  const [editingId, setEditingId] = useState<number | null>(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
>>>>>>> Stashed changes

  useEffect(() => {
    void fetchServices();
  }, []);

  async function fetchServices() {
    try {
<<<<<<< Updated upstream
      setLoading(true);
      setError('');

      const response = await fetch('/api/services');

      if (!response.ok) {
        const result: ApiErrorResponse = await response.json();

        throw new Error(
          result.error?.message ?? 'Unable to load services.',
        );
      }

      const result: { data: Service[] } = await response.json();

      setServices(result.data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load services.');
      }
    } finally {
      setLoading(false);
=======
      setError('');

      const response = await fetch(
        'http://localhost:3001/api/services'
      );

      if (!response.ok) {
        throw new Error('Unable to load services.');
      }

      const data: Service[] = await response.json();
      setServices(data);
    } catch (err) {
      console.error(err);
      setError(
        'Could not load services. Make sure the backend server is running.'
      );
>>>>>>> Stashed changes
    }
  }

  function handleChange(
    event:
      | React.ChangeEvent<HTMLInputElement>
<<<<<<< Updated upstream
      | React.ChangeEvent<HTMLTextAreaElement>,
=======
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
>>>>>>> Stashed changes
  ) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

<<<<<<< Updated upstream
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
      setError(
        'Expected duration must be greater than 0.',
      );
      return;
    }

    if (
      !Number.isInteger(priority) ||
      priority < 0
    ) {
      setError(
        'Priority must be a non-negative integer.',
      );
=======
    setMessage('');
    setError('');

    if (
      !formData.name.trim() ||
      !formData.description.trim() ||
      !formData.expectedDuration
    ) {
      setError('Please complete all fields.');
      return;
    }

    const duration = Number(formData.expectedDuration);

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Expected duration must be greater than 0.');
>>>>>>> Stashed changes
      return;
    }

    const serviceData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
<<<<<<< Updated upstream
      expectedDurationMinutes,
      priority,
    };

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const url = isEditing
        ? `/api/services/${editingId}`
        : '/api/services';
=======
      expectedDuration: duration,
      priorityLevel: formData.priorityLevel,
    };

    try {
      const isEditing = editingId !== null;

      const url = isEditing
        ? `http://localhost:3001/api/services/${editingId}`
        : 'http://localhost:3001/api/services';
>>>>>>> Stashed changes

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData),
      });

<<<<<<< Updated upstream
      const result = await response.json();

      if (!response.ok) {
        const apiError = result as ApiErrorResponse;

        setError(
          apiError.error?.message ??
            'Unable to save service.',
        );

=======
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Unable to save service.');
>>>>>>> Stashed changes
        return;
      }

      setMessage(
        isEditing
          ? 'Service updated successfully.'
<<<<<<< Updated upstream
          : 'Service created successfully.',
      );

      setEditingId(null);
      setFormData(emptyForm);

      await fetchServices();
    } catch {
      setError(
        'Unable to connect to the service API.',
      );
    } finally {
      setSaving(false);
=======
          : 'Service created successfully.'
      );

      setFormData(emptyForm);
      setEditingId(null);

      await fetchServices();
    } catch (err) {
      console.error(err);
      setError(
        'Could not save service. Make sure the backend server is running.'
      );
>>>>>>> Stashed changes
    }
  }

  function handleEdit(service: Service) {
    setEditingId(service.id);

    setFormData({
      name: service.name,
      description: service.description,
<<<<<<< Updated upstream
      expectedDurationMinutes: String(
        service.expectedDurationMinutes,
      ),
      priority: String(service.priority),
=======
      expectedDuration: String(service.expectedDuration),
      priorityLevel: service.priorityLevel,
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          <p className="service-eyebrow">
            SERVICES
          </p>
=======
          <p className="service-eyebrow">SERVICES</p>
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
          <form
            className="service-form"
            onSubmit={handleSubmit}
          >
=======
          <form className="service-form" onSubmit={handleSubmit}>
>>>>>>> Stashed changes
            <label>
              Service Name
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
<<<<<<< Updated upstream
                maxLength={100}
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                maxLength={500}
=======
>>>>>>> Stashed changes
                placeholder="Describe the service"
                required
              />
            </label>

            <label>
              Expected Duration (minutes)
              <input
                type="number"
<<<<<<< Updated upstream
                name="expectedDurationMinutes"
                value={
                  formData.expectedDurationMinutes
                }
=======
                name="expectedDuration"
                value={formData.expectedDuration}
>>>>>>> Stashed changes
                onChange={handleChange}
                min="1"
                placeholder="15"
                required
              />
            </label>

            <label>
<<<<<<< Updated upstream
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
              Higher priority numbers are ranked
              first.
            </p>

=======
              Priority Level
              <select
                name="priorityLevel"
                value={formData.priorityLevel}
                onChange={handleChange}
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
              </select>
            </label>

>>>>>>> Stashed changes
            <div className="service-form__actions">
              <button
                type="submit"
                className="service-submit-button"
<<<<<<< Updated upstream
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId !== null
                    ? 'Update Service'
                    : 'Create Service'}
=======
              >
                {editingId !== null
                  ? 'Update Service'
                  : 'Create Service'}
>>>>>>> Stashed changes
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  className="service-cancel-button"
                  onClick={handleCancelEdit}
<<<<<<< Updated upstream
                  disabled={saving}
=======
>>>>>>> Stashed changes
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="service-panel">
<<<<<<< Updated upstream
          <p className="service-eyebrow">
            CURRENT SERVICES
          </p>

          <h2>Service List</h2>

          {loading ? (
            <p className="service-description">
              Loading services...
            </p>
          ) : services.length === 0 ? (
=======
          <p className="service-eyebrow">CURRENT SERVICES</p>

          <h2>Service List</h2>

          {services.length === 0 && !error ? (
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
                      <span className="service-priority">
                        Priority {service.priority}
=======
                      <span
                        className={`service-priority service-priority--${service.priorityLevel.toLowerCase()}`}
                      >
                        {service.priorityLevel}
>>>>>>> Stashed changes
                      </span>
                    </div>

                    <p>{service.description}</p>

                    <p>
<<<<<<< Updated upstream
                      <strong>
                        Expected Duration:
                      </strong>{' '}
                      {
                        service.expectedDurationMinutes
                      }{' '}
                      minutes
=======
                      <strong>Expected Duration:</strong>{' '}
                      {service.expectedDuration} minutes
>>>>>>> Stashed changes
                    </p>
                  </div>

                  <button
                    type="button"
                    className="service-edit-button"
<<<<<<< Updated upstream
                    onClick={() =>
                      handleEdit(service)
                    }
=======
                    onClick={() => handleEdit(service)}
>>>>>>> Stashed changes
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