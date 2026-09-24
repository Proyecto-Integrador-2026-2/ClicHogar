import React, { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';

type Role = 'Usuario' | 'Afiliado' | '';

type ClerkError = {
  code?: string;
  message?: string;
};

function getFirstClerkError(error: unknown): ClerkError | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const errors = (error as { errors?: unknown }).errors;

  if (!Array.isArray(errors)) {
    return undefined;
  }

  const firstError = errors[0];

  if (typeof firstError !== 'object' || firstError === null) {
    return undefined;
  }

  const { code, message } = firstError as {
    code?: unknown;
    message?: unknown;
  };

  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

export default function RegisterForm() {
  const { isLoaded, signUp, setActive } = useSignUp();

  // Estados de los campos del formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Estados para manejar errores (Caja Negra)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  // Función de validación basada en los Criterios de Aceptación
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Escenario 6: Campos obligatorios vacíos (nombre, correo o contraseña)
    if (!name.trim()) newErrors.name = 'Este campo es obligatorio';
    if (!email.trim()) newErrors.email = 'Este campo es obligatorio';
    if (!password) newErrors.password = 'Este campo es obligatorio';

    // Escenario 7: Formato de correo electrónico inválido
    const emailRegex = /^[^\s@]{1,64}@[^^\s@]{1,255}\.[^\s@]{2,63}$/;
    if (email && !emailRegex.test(email)) {
      newErrors.email = 'Por favor, ingresa un correo electrónico válido';
    }

    // Escenario 8: La contraseña no cumple con las políticas de seguridad (Límite inferior)
    // Validamos mínimo 8 caracteres, al menos un número y una mayúscula
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (password && !passwordRegex.test(password)) {
      newErrors.password =
        'La contraseña debe tener al menos 8 caracteres, incluir números y mayúsculas';
    }

    // Escenario 9: Las contraseñas no coinciden
    if (password && confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    // Escenario 5: Rol de usuario no seleccionado
    if (!role) {
      newErrors.role = 'Por favor, selecciona cómo deseas usar la plataforma';
    }

    // Escenario 4: Términos y condiciones no aceptados
    if (!termsAccepted) {
      newErrors.terms =
        'Debes aceptar los Términos, Condiciones y Política de Datos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Retorna true si no hay errores
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGlobalError('');

    // Prevenimos el envío si falla alguna validación del frontend
    if (!validateForm()) return;
    if (!isLoaded) return;

    try {
      // Escenario 1 y 2: Registro exitoso como "Usuario" o "Afiliado"
      await signUp.create({
        firstName: name, // Mapeamos el nombre
        emailAddress: email,
        password,
        unsafeMetadata: {
          rol: role, // Inyectamos el rol seleccionado para el manejo de Perfiles Duales
        },
      });

      // Enviamos el código de verificación al correo
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkError = getFirstClerkError(err);

      if (clerkError?.code === 'form_identifier_exists') {
        setGlobalError(
          'Este correo ya está asociado a una cuenta. ¿Deseas iniciar sesión?'
        );
      } else {
        setGlobalError(
          clerkError?.message || 'Ocurrió un error en el registro.'
        );
      }
    }
  };

  const handleVerify = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });

        // Redirección según rol (Escenarios 1 y 2)
        window.location.href =
          role === 'Afiliado' ? '/perfil/configurar' : '/dashboard';
      }
    } catch (err: unknown) {
      const clerkError = getFirstClerkError(err);

      setGlobalError(
        clerkError?.message || 'Código de verificación incorrecto.'
      );
    }
  };

  // --- Vista de Verificación ---
  if (pendingVerification) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Verifica tu correo</h2>
        <p className="mb-4 text-gray-600">Hemos enviado un código a {email}</p>
        {globalError && (
          <div className="p-3 mb-4 text-red-700 bg-red-100 rounded">
            {globalError}
          </div>
        )}
        <form onSubmit={handleVerify}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ingresa el código..."
            className="w-full p-2 mb-4 border rounded"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded"
          >
            Verificar cuenta
          </button>
        </form>
      </div>
    );
  }

  // --- Vista del Formulario de Registro ---
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">
        Únete a Clic Hogar
      </h2>

      {globalError && (
        <div className="p-3 mb-4 text-red-700 bg-red-100 rounded text-sm">
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Nombre */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Nombre Completo
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>

        {/* Selector de Roles */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium mb-1">
            Rol
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => {
              const value = e.target.value;

              if (value === '' || value === 'Usuario' || value === 'Afiliado') {
                setRole(value);
              }
            }}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${errors.role ? 'border-red-500' : ''}`}
          >
            <option value="">Selecciona tu rol...</option>
            <option value="Usuario">Busco servicios (Usuario)</option>
            <option value="Afiliado">Ofrezco servicios (Afiliado)</option>
          </select>
          {errors.role && (
            <p className="text-red-500 text-xs mt-1">{errors.role}</p>
          )}
        </div>

        {/* Correo Electrónico */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Correo Electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : ''}`}
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirmar Contraseña */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-1"
          >
            Confirmar Contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : ''}`}
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Términos y Condiciones */}
        <div className="flex items-start flex-col">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              Acepto los Términos, Condiciones y Política de Datos
            </label>
          </div>
          {errors.terms && (
            <p className="text-red-500 text-xs mt-1">{errors.terms}</p>
          )}
        </div>

        {/* Botón Submit */}
        <button
          type="submit"
          disabled={!isLoaded}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-400"
        >
          Crear cuenta
        </button>
      </form>
    </div>
  );
}
