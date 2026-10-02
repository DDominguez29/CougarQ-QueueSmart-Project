import './LoginPage.css';

function LoginPage() {
  return (
    <div className="login-page">
      <header className="login-header">
        <div className="login-header__content">
          <h1>QueueSmart</h1>
          <p>User Login</p>
        </div>
      </header>

      <main className="login-main">
        <section className="login-card">
          <h2>Login</h2>

          <form className="login-form">
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                required
                maxLength={100}
              />
            </div>

            <div className="login-field">
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

            <button className="login-button" type="submit">
              Login
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default LoginPage;