/**
 * Pruebas de los primitivos de formulario: etiqueta, pista, error y
 * `aria-*`, más el comportamiento de cada control.
 */
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React, { createRef } from 'react';
import {
  CheckField,
  ErrorSummary,
  FileField,
  PasswordField,
  SelectField,
  TextField,
} from './fields';

afterEach(cleanup);

describe('TextField', () => {
  test('rinde etiqueta obligatoria, pista y propaga cambios y blur', () => {
    // Given: un TextField obligatorio con pista y handlers de cambio y blur
    const onChange = mock();
    const onBlur = mock();
    // When: se renderiza
    render(
      <TextField
        id="nombre"
        label="Nombre"
        type="text"
        value="Ana"
        required
        hint="Tu nombre"
        onChange={onChange}
        onBlur={onBlur}
      />
    );
    const input = screen.getByLabelText(/Nombre/) as HTMLInputElement;
    // Then: muestra la marca de obligatorio, la pista y aria-describedby
    expect(screen.getByText('(obligatorio)')).toBeTruthy();
    expect(screen.getByText('Tu nombre')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBeNull();

    // When: se cambia el valor y se pierde el foco
    fireEvent.change(input, { target: { value: 'Luis' } });
    // Then: se llaman onChange y onBlur
    expect(onChange).toHaveBeenCalledWith('Luis');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });

  test('con error marca aria-invalid y muestra el mensaje', () => {
    // Given: un TextField de email con un mensaje de error
    // When: se renderiza
    render(
      <TextField
        id="e"
        label="Correo"
        type="email"
        value=""
        error="Inválido"
        onChange={() => {}}
      />
    );
    const input = screen.getByLabelText(/Correo/);
    // Then: queda marcado inválido, con el mensaje visible y sin marca de obligatorio
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toContain('--error');
    expect(screen.getByText('Inválido')).toBeTruthy();
    expect(screen.queryByText('(obligatorio)')).toBeNull();
  });
});

describe('PasswordField', () => {
  const base = { id: 'p', label: 'Contraseña', value: 'x', onBlur: () => {} };

  test('alterna la visibilidad', () => {
    // Given: un PasswordField con valor
    // When: se renderiza
    render(<PasswordField {...base} onChange={() => {}} />);
    const input = screen.getByLabelText(/Contraseña/, {
      selector: 'input',
    }) as HTMLInputElement;
    // Then: el valor está oculto y usa new-password
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    // When: se pulsa Mostrar contraseña
    fireEvent.click(screen.getByLabelText('Mostrar contraseña'));
    // Then: el valor se ve
    expect(input.type).toBe('text');
    // When: se pulsa Ocultar contraseña
    fireEvent.click(screen.getByLabelText('Ocultar contraseña'));
    // Then: vuelve a ocultarse
    expect(input.type).toBe('password');
  });

  test('pista, error, autocomplete propio y cambios', () => {
    const onChange = mock();
    // Given: un PasswordField con pista, error y autocomplete propio
    // When: se renderiza
    render(
      <PasswordField
        {...base}
        onChange={onChange}
        hint="8 caracteres"
        error="Muy corta"
        autoComplete="current-password"
      />
    );
    const input = screen.getByLabelText(/Contraseña/, {
      selector: 'input',
    }) as HTMLInputElement;
    // Then: respeta el autocomplete y muestra pista y error
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByText('8 caracteres')).toBeTruthy();
    expect(screen.getByText('Muy corta')).toBeTruthy();
    // When: se cambia el valor
    fireEvent.change(input, { target: { value: 'nueva' } });
    // Then: se llama onChange con el valor nuevo
    expect(onChange).toHaveBeenCalledWith('nueva');
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'a', label: 'Opción A' },
    { value: 'b', label: 'Opción B' },
  ];

  test('rinde opciones, obligatoriedad y propaga cambios', () => {
    // Given: un SelectField obligatorio con opciones, pista y error
    const onChange = mock();
    // When: se renderiza
    render(
      <SelectField
        id="s"
        label="Rol"
        value=""
        required
        hint="Elige uno"
        error="Falta"
        options={options}
        placeholder="Selecciona"
        onChange={onChange}
        onBlur={() => {}}
      />
    );
    // Then: muestra el placeholder, las opciones, la marca de obligatorio, la pista y el error
    expect(screen.getByText('Selecciona')).toBeTruthy();
    expect(screen.getByText('Opción B')).toBeTruthy();
    expect(screen.getByText('(obligatorio)')).toBeTruthy();
    expect(screen.getByText('Elige uno')).toBeTruthy();
    expect(screen.getByText('Falta')).toBeTruthy();
    // When: se elige la opción 'b'
    fireEvent.change(screen.getByLabelText(/Rol/), { target: { value: 'b' } });
    // Then: se llama onChange con 'b'
    expect(onChange).toHaveBeenCalledWith('b');
  });

  test('sin extras no añade obligatorio ni descripción', () => {
    // Given: un SelectField sin pista, error ni obligatorio
    // When: se renderiza
    render(
      <SelectField
        id="s"
        label="Rol"
        value="a"
        options={options}
        placeholder="Selecciona"
        onChange={() => {}}
        onBlur={() => {}}
      />
    );
    // Then: no añade marca de obligatorio ni aria-describedby
    expect(screen.queryByText('(obligatorio)')).toBeNull();
    expect(
      screen.getByLabelText(/Rol/).getAttribute('aria-describedby')
    ).toBeNull();
  });
});

describe('FileField', () => {
  test('entrega el archivo elegido o null', () => {
    // Given: un FileField con pista y error
    const onChange = mock();
    // When: se renderiza
    render(
      <FileField
        id="f"
        label="Foto"
        accept="image/png"
        hint="Máx 5 MB"
        error="Muy pesada"
        onChange={onChange}
        onBlur={() => {}}
      />
    );
    const input = screen.getByLabelText('Foto') as HTMLInputElement;
    // Then: muestra la pista y el error
    expect(screen.getByText('Máx 5 MB')).toBeTruthy();
    expect(screen.getByText('Muy pesada')).toBeTruthy();

    const archivo = new File(['x'], 'a.png', { type: 'image/png' });
    // When: se elige un archivo
    fireEvent.change(input, { target: { files: [archivo] } });
    // Then: entrega el archivo elegido
    expect(onChange).toHaveBeenLastCalledWith(archivo);
    // When: se quita la selección
    fireEvent.change(input, { target: { files: [] } });
    // Then: entrega null
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test('sin pista ni error queda limpio', () => {
    // Given: un FileField sin pista ni error
    // When: se renderiza
    render(
      <FileField
        id="f"
        label="Foto"
        accept="image/png"
        onChange={() => {}}
        onBlur={() => {}}
      />
    );
    // Then: no queda marcado como inválido
    expect(
      screen.getByLabelText('Foto').getAttribute('aria-invalid')
    ).toBeNull();
  });
});

describe('CheckField', () => {
  test('propaga el estado marcado y muestra el error', () => {
    // Given: un CheckField desmarcado con error
    const onChange = mock();
    // When: se renderiza
    render(
      <CheckField
        id="c"
        label="Acepto"
        checked={false}
        error="Obligatorio"
        onChange={onChange}
        onBlur={() => {}}
      />
    );
    const check = screen.getByLabelText('Acepto');
    // Then: queda inválido y muestra el error
    expect(check.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Obligatorio')).toBeTruthy();
    // When: se hace clic en la casilla
    fireEvent.click(check);
    // Then: notifica que quedó marcada
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('sin error no marca inválido', () => {
    // Given: un CheckField marcado y sin error
    // When: se renderiza
    render(
      <CheckField
        id="c"
        label="Acepto"
        checked
        onChange={() => {}}
        onBlur={() => {}}
      />
    );
    // Then: no queda marcado como inválido
    expect(
      screen.getByLabelText('Acepto').getAttribute('aria-invalid')
    ).toBeNull();
  });
});

describe('ErrorSummary', () => {
  test('no rinde nada sin errores', () => {
    // Given: un resumen sin errores
    // When: se renderiza
    const { container } = render(<ErrorSummary title="Errores" items={[]} />);
    // Then: no rinde nada
    expect(container.innerHTML).toBe('');
  });

  test('lista los errores con enlace al campo y acepta ref', () => {
    // Given: un resumen con un error del campo 'nombre' y un ref
    const ref = createRef<HTMLDivElement>();
    // When: se renderiza
    render(
      <ErrorSummary
        ref={ref}
        title="Corrige"
        items={[{ field: 'nombre', label: 'Nombre', message: 'Falta nombre' }]}
      />
    );
    // Then: rinde la alerta, entrega el ref y enlaza el mensaje con #nombre
    expect(ref.current).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Falta nombre').getAttribute('href')).toBe(
      '#nombre'
    );
  });
});
