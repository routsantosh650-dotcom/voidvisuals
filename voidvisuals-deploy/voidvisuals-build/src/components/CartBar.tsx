import React from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { price } from '../data/vvData';
import { useCartActions, useCartTotals } from '../lib/cart';
import { showToast } from '../lib/toast';
import './Billing.css';

interface Props {
  couponPercent: number;
  onOpen: () => void;
}

/**
 * The sticky cart pill. It only exists once something is in the cart, so a visitor who is just
 * reading never sees a shop window.
 */
export const CartBar: React.FC<Props> = ({ couponPercent, onOpen }) => {
  const totals = useCartTotals(couponPercent);
  const actions = useCartActions();
  if (!totals.count) return null;

  return (
    <div className="cart-bar" data-allow-native-menu>
      <button type="button" className="cart-pill" onClick={onOpen}>
        <span className="cart-ico">
          <ShoppingBag size={16} />
          <b>{totals.count}</b>
        </span>
        <span className="cart-txt">
          {totals.discountInr > 0 ? <s>{price(totals.subtotalInr)}</s> : null}
          {price(totals.totalInr)}
          <small>to pay · UPI</small>
        </span>
        <span className="cart-go">Checkout</span>
      </button>
      <button
        type="button"
        className="cart-x"
        aria-label="Empty cart"
        onClick={() => {
          actions.clear();
          showToast('Cart emptied.', 'info');
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
};
