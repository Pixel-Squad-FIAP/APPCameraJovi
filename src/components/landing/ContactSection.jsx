import { useState } from 'react';

const initialErrors = {
  name: '',
  email: '',
  message: ''
};

export default function ContactSection() {
  const [values, setValues] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState(initialErrors);
  const [status, setStatus] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = { ...initialErrors };
    let valid = true;

    if (values.name.trim().length < 2) {
      nextErrors.name = 'Informe um nome com pelo menos 2 caracteres.';
      valid = false;
    }

    if (!event.currentTarget.elements.email.validity.valid) {
      nextErrors.email = 'Informe um e-mail válido.';
      valid = false;
    }

    if (values.message.trim().length < 10) {
      nextErrors.message = 'Escreva uma mensagem com pelo menos 10 caracteres.';
      valid = false;
    }

    setErrors(nextErrors);
    setStatus(valid ? 'Campos validados no front-end. Nenhum envio foi realizado.' : '');
  };

  return (
    <section className="mx-auto grid w-full max-w-[1120px] gap-7 px-4 py-[78px] sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start" id="contato" aria-labelledby="contato-title">
      <div className="max-w-[540px]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.05em] text-[#b2c7d8]">Contato</p>
        <h2 id="contato-title" className="max-w-[740px] text-[clamp(1.55rem,4.6vw,2.45rem)] font-bold leading-[1.12] text-[#f0f0ec]">Demonstração de interface.</h2>
        <p className="mt-4 text-[#bec4c8]">O formulário abaixo valida os campos no navegador e não envia dados para servidor ou serviço externo.</p>
      </div>

      <form className="grid gap-4 rounded border border-[#303740] bg-[#0b0d10] p-5" id="contact-form" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <label className="font-bold text-[#f0f0ec]" htmlFor="name">Nome</label>
          <input
            aria-invalid={errors.name ? 'true' : 'false'}
            autoComplete="name"
            className="w-full rounded border border-[#303740] bg-[#0b0d10] px-3.5 py-3 text-[#f0f0ec] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85afd5] aria-[invalid=true]:border-[#ff7f8f]"
            id="name"
            minLength={2}
            name="name"
            onChange={handleChange}
            required
            type="text"
            value={values.name}
          />
          <small className="min-h-[1.25em] font-bold text-[#ff9cac]" id="name-error">{errors.name}</small>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#f0f0ec]" htmlFor="email">E-mail</label>
          <input
            aria-invalid={errors.email ? 'true' : 'false'}
            autoComplete="email"
            className="w-full rounded border border-[#303740] bg-[#0b0d10] px-3.5 py-3 text-[#f0f0ec] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85afd5] aria-[invalid=true]:border-[#ff7f8f]"
            id="email"
            name="email"
            onChange={handleChange}
            required
            type="email"
            value={values.email}
          />
          <small className="min-h-[1.25em] font-bold text-[#ff9cac]" id="email-error">{errors.email}</small>
        </div>

        <div className="grid gap-2">
          <label className="font-bold text-[#f0f0ec]" htmlFor="message">Mensagem</label>
          <textarea
            aria-invalid={errors.message ? 'true' : 'false'}
            className="w-full resize-y rounded border border-[#303740] bg-[#0b0d10] px-3.5 py-3 text-[#f0f0ec] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#85afd5] aria-[invalid=true]:border-[#ff7f8f]"
            id="message"
            minLength={10}
            name="message"
            onChange={handleChange}
            required
            rows={5}
            value={values.message}
          />
          <small className="min-h-[1.25em] font-bold text-[#ff9cac]" id="message-error">{errors.message}</small>
        </div>

        <button className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded bg-[#d9d5ca] px-5 font-bold text-[#14171b] hover:bg-[#c8c3b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#85afd5] max-[390px]:w-full" type="submit">
          Validar mensagem
        </button>
        <p className="m-0 min-h-6 font-bold text-[#b4cbbd]" id="form-status" role="status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}
