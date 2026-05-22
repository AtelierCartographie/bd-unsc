<script lang="ts">
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  const yearRange =
    startYear === currentYear ? startYear : `${startYear} - ${currentYear}`;
</script>

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-bottom">
      <p>
        Created by <a
          href="https://github.com/TomBor"
          target="_blank"
          rel="noopener">Thomas Ansart</a
        >
        —
        <a
          href="https://www.sciencespo.fr/cartographie/"
          target="_blank"
          rel="noopener">Atelier de cartographie de Sciences Po</a
        >
      </p>

      <p class="footer-license">
        ISC License — {yearRange}
      </p>
    </div>
  </div>
</footer>

<style>
  .footer {
    background: #1a1a1a;
    color: #e5e7eb;
    padding: 2rem 0 2rem;
  }

  .footer-inner {
    margin: 0 auto;
    padding: 0 2rem;
  }

  .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .footer-bottom a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-bottom a:hover {
    opacity: 1;
    color: #fff;
  }

  @media (max-width: 768px) {
    .footer-bottom {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
