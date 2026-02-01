-- Fix status for imported orders: change 'Betaald' to 'paid'
UPDATE orders SET status = 'paid' WHERE status = 'Betaald';