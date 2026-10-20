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
    const onChange = mock();
    const onBlur = mock();
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
    expect(screen.getByText('(obligatorio)')).toBeTruthy();
    expect(screen.getByText('Tu nombre')).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBeNull();

    fireEvent.change(input, { target: { value: 'Luis' } });
    expect(onChange).toHaveBeenCalledWith('Luis');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });

  test('con error marca aria-invalid y muestra el mensaje', () => {
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
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toContain('--error');
    expect(screen.getByText('Inválido')).toBeTruthy();
    expect(screen.queryByText('(obligatorio)')).toBeNull();
  });
});

describe('PasswordField', () => {
  const base = { id: 'p', label: 'Contraseña', value: 'x', onBlur: () => {} };

  test('alterna la visibilidad', () => {
    render(<PasswordField {...base} onChange={() => {}} />);
    const input = screen.getByLabelText(/Contraseña/, {
      selector: 'input',
    }) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    fireEvent.click(screen.getByLabelText('Mostrar contraseña'));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByLabelText('Ocultar contraseña'));
    expect(input.type).toBe('password');
  });

  test('pista, error, autocomplete propio y cambios', () => {
    const onChange = mock();
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
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByText('8 caracteres')).toBeTruthy();
    expect(screen.getByText('Muy corta')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'nueva' } });
    expect(onChange).toHaveBeenCalledWith('nueva');
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'a', label: 'Opción A' },
    { value: 'b', label: 'Opción B' },
  ];

  test('rinde opciones, obligatoriedad y propaga cambios', () => {
    const onChange = mock();
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
    expect(screen.getByText('Selecciona')).toBeTruthy();
    expect(screen.getByText('Opción B')).toBeTruthy();
    expect(screen.getByText('(obligatorio)')).toBeTruthy();
    expect(screen.getByText('Elige uno')).toBeTruthy();
    expect(screen.getByText('Falta')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Rol/), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  test('sin extras no añade obligatorio ni descripción', () => {
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
    expect(screen.queryByText('(obligatorio)')).toBeNull();
    expect(
      screen.getByLabelText(/Rol/).getAttribute('aria-describedby')
    ).toBeNull();
  });
});

describe('FileField', () => {
  test('entrega el archivo elegido o null', () => {
    const onChange = mock();
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
    expect(screen.getByText('Máx 5 MB')).toBeTruthy();
    expect(screen.getByText('Muy pesada')).toBeTruthy();

    const archivo = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [archivo] } });
    expect(onChange).toHaveBeenLastCalledWith(archivo);
    fireEvent.change(input, { target: { files: [] } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test('sin pista ni error queda limpio', () => {
    render(
      <FileField
        id="f"
        label="Foto"
        accept="image/png"
        onChange={() => {}}
        onBlur={() => {}}
      />
    );
    expect(
      screen.getByLabelText('Foto').getAttribute('aria-invalid')
    ).toBeNull();
  });
});

describe('CheckField', () => {
  test('propaga el estado marcado y muestra el error', () => {
    const onChange = mock();
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
    expect(check.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Obligatorio')).toBeTruthy();
    fireEvent.click(check);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('sin error no marca inválido', () => {
    render(
      <CheckField
        id="c"
        label="Acepto"
        checked
        onChange={() => {}}
        onBlur={() => {}}
      />
    );
    expect(
      screen.getByLabelText('Acepto').getAttribute('aria-invalid')
    ).toBeNull();
  });
});

describe('ErrorSummary', () => {
  test('no rinde nada sin errores', () => {
    const { container } = render(<ErrorSummary title="Errores" items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  test('lista los errores con enlace al campo y acepta ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ErrorSummary
        ref={ref}
        title="Corrige"
        items={[{ field: 'nombre', label: 'Nombre', message: 'Falta nombre' }]}
      />
    );
    expect(ref.current).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Falta nombre').getAttribute('href')).toBe(
      '#nombre'
    );
  });
});
