import './RegisterPage.css';

function RegisterPage() {
  return (
    <div className="register-page">
      <header className="register-header">
        <div className="register-header__content">
          <h1>QueueSmart</h1>
          <p>Create your account.</p>
        </div>
      </header>

      <main className="register-main">
        <section className="register-card">
          <h2>Register</h2>

          <form className="register-form">
            <div className="register-field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={50}
              />
            </div>

            <div className="register-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                required
                maxLength={100}
              />
            </div>

            <div className="register-field">
              <label htmlFor="studentId">Student ID</label>
              <input
                id="studentId"
                type="number"
                name="studentId"
                required
                min={1}
              />
            </div>

            <div className="register-field">
              <label htmlFor="birthDate">Date of Birth</label>
              <input
                id="birthDate"
                type="date"
                name="birthDate"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                required
                minLength={8}
                maxLength={50}
              />
            </div>

            <button className="register-button" type="submit">
              Register
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default RegisterPage;